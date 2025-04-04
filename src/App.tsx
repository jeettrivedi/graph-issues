import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FiSun, FiMoon } from 'react-icons/fi';
import GraphVisualization, { Node } from './components/GraphVisualization';

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  created_at: string;
  body: string;
  comments_url: string;
  labels: {
    name: string;
    color: string;
  }[];
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubComment {
  body: string;
}

interface HoveredNode {
  data: Node;
  mouseX: number;
  mouseY: number;
}

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; edges: Array<{ id: string; source: string; target: string }> }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const hasShownWarning = useRef(false);

  useEffect(() => {
    const bodyClass = document.body.classList;

    if (darkMode) {
      bodyClass.add("dark");
    } else {
      bodyClass.remove("dark");
    }

    // Cleanup function to ensure no memory leaks
    return () => {
      bodyClass.remove("dark");
    };
  }, [darkMode]);

  const validateGitHubUrl = (url: string): boolean => {
    const githubUrlPattern = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+\/?$/;
    return githubUrlPattern.test(url);
  };

  const extractRepoInfo = (url: string) => {
    const parts = url.replace('https://github.com/', '').split('/');
    return { owner: parts[0], repo: parts[1] };
  };

  const findIssueReferences = (text: string): number[] => {
    // Match #number patterns that reference issues
    const matches = text.match(/#(\d+)/g) || [];
    return matches.map(match => parseInt(match.substring(1)));
  };

  const buildGraphData = (issues: GitHubIssue[], commentsMap: Map<number, GitHubComment[]>) => {
    // Create nodes and edges first
    const nodes: Node[] = [];
    const edges: Array<{ id: string; source: string; target: string }> = [];
    const issueMap = new Map<number, GitHubIssue>();
    const inDegreeCount = new Map<string, number>();

    // Create a map of all issues for quick lookup
    issues.forEach(issue => {
      issueMap.set(issue.number, issue);
      // Initialize in-degree count for each issue
      inDegreeCount.set(`${issue.number}`, 0);
    });

    // Create nodes and collect edges
    issues.forEach(issue => {
      const issueId = `${issue.number}`;
      
      // Create node (size will be set after counting edges)
      nodes.push({
        id: issueId,
        label: `#${issue.number}`,
        size: 1, // default size, will be updated
        attributes: {
          title: issue.title,
          body: issue.body,
          state: issue.state,
          createdAt: issue.created_at,
          number: issue.number,
          labels: issue.labels,
          url: issue.html_url,
          author: issue.user.login,
          authorAvatar: issue.user.avatar_url
        }
      });

      // Find references in issue body and comments
      const bodyRefs = findIssueReferences(issue.body || '');
      const comments = commentsMap.get(issue.number) || [];
      const commentRefs = comments.flatMap(comment => findIssueReferences(comment.body));
      const allRefs = [...new Set([...bodyRefs, ...commentRefs])];

      // Create edges and count incoming references
      allRefs.forEach(refNumber => {
        if (issueMap.has(refNumber) && refNumber !== issue.number) {
          const refId = `${refNumber}`;
          edges.push({
            id: `${issueId}-${refId}`,
            source: issueId,
            target: refId
          });
          // Increment in-degree count for the target node
          inDegreeCount.set(refId, (inDegreeCount.get(refId) || 0) + 1);
        }
      });
    });

    // Update node sizes based on in-degree
    nodes.forEach(node => {
      const inDegree = inDegreeCount.get(node.id) || 0;
      node.size = Math.max(1, inDegree + 1); // Add 1 to make sure even nodes with no incoming edges are visible
    });

    return { nodes, edges };
  };

  const fetchWithAuth = (url: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json'
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    return fetch(url, { headers });
  };

  const fetchAllIssues = async (owner: string, repo: string) => {
    let allIssues: GitHubIssue[] = [];
    let page = 1;
    const per_page = 100; // Maximum allowed by GitHub API
    const requestLimit = !token ? 60 : Infinity; // Limit requests if no token
    let requestCount = 0;
    
    while (true) {
      // Check if we're about to exceed the request limit
      if (requestCount >= requestLimit) {
        toast('Request limit reached. Please provide a GitHub token to fetch more issues.', {
          icon: '⚠️',
          duration: 4000
        });
        break;
      }

      requestCount++;
      const response = await fetchWithAuth(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${per_page}&page=${page}`
      );
      
      if (!response.ok) {
        // Check for rate limit exceeded
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            const resetTime = new Date(Number(response.headers.get('x-ratelimit-reset')) * 1000);
            throw new Error(`GitHub API rate limit exceeded. Rate limit will reset at ${resetTime.toLocaleString()}`);
          }
        }
        throw new Error('Failed to fetch issues');
      }
      
      const issues = await response.json();
      if (issues.length === 0) break;
      
      allIssues = [...allIssues, ...issues];
      page++;

      // Add a loading toast to show progress
      toast.loading(`Loaded ${allIssues.length} issues...`, { id: 'loading-issues' });

      // Check remaining rate limit
      const rateLimitRemaining = Number(response.headers.get('x-ratelimit-remaining'));
      if (rateLimitRemaining <= 1) { // Leave 1 request as buffer
        toast('Approaching rate limit. Please provide a GitHub token to fetch more issues.', {
          icon: '⚠️',
          duration: 4000
        });
        break;
      }
    }

    // Dismiss the loading toast
    toast.dismiss('loading-issues');
    
    return allIssues;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGitHubUrl(repoUrl)) {
      toast.error('Please enter a valid GitHub repository URL');
      return;
    }

    setLoading(true);
    try {
      const { owner, repo } = extractRepoInfo(repoUrl);

      // Show warning if no token is provided and we haven't shown it before
      if (!token && !hasShownWarning.current) {
        hasShownWarning.current = true;
        toast('No GitHub token provided. You will be limited to 60 requests per hour. For higher limits, please provide a GitHub token.', {
          icon: '⚠️',
          duration: 6000
        });
        
        // Show additional rate limit info
        toast('Without a token: 60 requests/hour\nWith a token: 5,000 requests/hour', {
          icon: 'ℹ️',
          duration: 6000
        });
      }

      // Fetch all issues with pagination
      const issuesData = await fetchAllIssues(owner, repo);
      setIssues(issuesData);

      // Fetch comments for each issue
      const commentsMap = new Map<number, GitHubComment[]>();
      const commentPromises = issuesData.map(async (issue: GitHubIssue) => {
        // Skip if we're approaching the rate limit for non-token users
        if (!token && commentsMap.size >= 58) { // Leave 2 requests as buffer
          return;
        }
        
        const commentsResponse = await fetchWithAuth(issue.comments_url);
        if (commentsResponse.ok) {
          const comments = await commentsResponse.json();
          commentsMap.set(issue.number, comments);
        }
      });

      await Promise.all(commentPromises);

      // Build and set graph data
      const newGraphData = buildGraphData(issuesData, commentsMap);
      setGraphData(newGraphData);
      
      // Show success message with appropriate context
      if (!token && issuesData.length > 0) {
        toast.success(`Loaded ${issuesData.length} issues (limited due to no token)`);
      } else {
        toast.success(`Loaded ${issuesData.length} issues successfully`);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to fetch repository data');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col">
      <Toaster position="top-right" />
      <div className="bg-black text-white py-2 px-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">GitHub Issues Graph</h1>

          <div className="flex items-center gap-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-4">
              <div>
                <input
                  type="text"
                  id="repoUrl"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className={`w-80 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 sm:text-sm py-2 px-4 transition-colors duration-200
                    ${darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:ring-offset-white'
                    }`}
                  required
                />
              </div>

              <div>
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="GitHub Token (Optional)"
                  className={`w-64 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 sm:text-sm py-2 px-4 transition-colors duration-200
                    ${darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:ring-offset-white'
                    }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'} 
                  text-white bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                  ${darkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}`}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </form>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)]">
        {graphData.nodes.length > 0 && (
          <div className="h-full">
            <GraphVisualization
              graphData={graphData}
              onNodeHover={(node) => {
                if (node) {
                  setHoveredNode({
                    data: node,
                    mouseX: 0,
                    mouseY: 0
                  });
                } else {
                  setHoveredNode(null);
                }
              }}
              onNodeClick={setSelectedNode}
              darkMode={darkMode}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;