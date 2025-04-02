import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FiSun, FiMoon } from 'react-icons/fi';
import GraphVisualization, { Node } from './GraphVisualization';

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
    // First create a map to count incoming references
    const incomingReferenceCounts = new Map<string, number>();
    const issueMap = new Map<number, GitHubIssue>();

    // Create a map of all issues for quick lookup
    issues.forEach(issue => {
      issueMap.set(issue.number, issue);
    });

    // Count incoming references first
    issues.forEach(issue => {
      const bodyRefs = findIssueReferences(issue.body || '');
      const comments = commentsMap.get(issue.number) || [];
      const commentRefs = comments.flatMap(comment => findIssueReferences(comment.body));
      const allRefs = [...new Set([...bodyRefs, ...commentRefs])];

      allRefs.forEach(refNumber => {
        const refId = `${refNumber}`;
        incomingReferenceCounts.set(refId, (incomingReferenceCounts.get(refId) || 0) + 1);
      });
    });

    // Create nodes and edges
    const nodes: Node[] = [];
    const edges: Array<{ id: string; source: string; target: string }> = [];

    // First create all nodes
    issues.forEach(issue => {
      const issueId = `${issue.number}`;
      const incomingCount = incomingReferenceCounts.get(issueId) || 0;

      // Create node with size based on incoming references
      nodes.push({
        id: issueId,
        label: `#${issue.number}`,
        size: Math.max(1, incomingCount + 1),
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
    });

    // Then create edges only for existing nodes
    issues.forEach(issue => {
      const issueId = `${issue.number}`;
      const bodyRefs = findIssueReferences(issue.body || '');
      const comments = commentsMap.get(issue.number) || [];
      const commentRefs = comments.flatMap(comment => findIssueReferences(comment.body));
      const allRefs = [...new Set([...bodyRefs, ...commentRefs])];

      allRefs.forEach(refNumber => {
        // Only create edge if the referenced issue exists and is not the same issue
        if (issueMap.has(refNumber) && refNumber !== issue.number) {
          const refId = `${refNumber}`;
          edges.push({
            id: `${issueId}-${refId}`,
            source: issueId,
            target: refId
          });
        }
      });
    });

    return { nodes, edges };
  };

  const fetchWithAuth = (url: string) => {
    return fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
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

      // Fetch only open issues
      const issuesResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`);
      if (!issuesResponse.ok) throw new Error('Failed to fetch issues');
      const issuesData = await issuesResponse.json();
      setIssues(issuesData);

      // Fetch comments for each issue
      const commentsMap = new Map<number, GitHubComment[]>();
      await Promise.all(issuesData.map(async (issue: GitHubIssue) => {
        const commentsResponse = await fetchWithAuth(issue.comments_url);
        if (commentsResponse.ok) {
          const comments = await commentsResponse.json();
          commentsMap.set(issue.number, comments);
        }
      }));

      // Build and set graph data
      const newGraphData = buildGraphData(issuesData, commentsMap);
      setGraphData(newGraphData);
      toast.success('Graph data loaded successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch repository data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
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
                  className="w-80 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-800 text-white placeholder-gray-400 py-2 px-4"
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
                  className="w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-800 text-white placeholder-gray-400 py-2 px-4"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
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

      <main className="flex-grow dark:bg-gray-900">
        <div className="max-w-7xl mx-auto dark:text-white">
          {hoveredNode && (
            <div className="fixed p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm z-50">
              <h3 className="font-semibold text-lg mb-2 dark:text-white">{hoveredNode.data.attributes.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">#{hoveredNode.data.attributes.number}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{hoveredNode.data.attributes.body?.substring(0, 100) || 'No description'}...</p>
            </div>
          )}

          {selectedNode && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <img
                      src={selectedNode.attributes.authorAvatar}
                      alt={selectedNode.attributes.author}
                      className="w-10 h-10 rounded-full mr-4"
                    />
                    <span className="font-medium dark:text-white">{selectedNode.attributes.author}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">{selectedNode.attributes.title}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{selectedNode.attributes.body || 'No description'}</p>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span>#{selectedNode.attributes.number}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(selectedNode.attributes.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 p-4">
            {graphData.nodes.length > 0 && (
              <div className="w-full h-[calc(100vh-5rem)]">
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
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;