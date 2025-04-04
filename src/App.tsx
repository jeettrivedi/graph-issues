import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { FiSun, FiMoon } from "react-icons/fi";
import GraphVisualization, { Node } from "./components/GraphVisualization";

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
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [_issues, setIssues] = useState<GitHubIssue[]>([]);
  const [graphData, setGraphData] = useState<{
    nodes: Node[];
    edges: Array<{ id: string; source: string; target: string }>;
  }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [_hoverNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const [_selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
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
    const githubUrlPattern =
      /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+\/?$/;
    return githubUrlPattern.test(url);
  };

  const extractRepoInfo = (url: string) => {
    const parts = url.replace("https://github.com/", "").split("/");
    return { owner: parts[0], repo: parts[1] };
  };

  const findIssueReferences = (text: string): number[] => {
    // Match #number patterns that reference issues
    const matches = text.match(/#(\d+)/g) || [];
    return matches.map((match) => parseInt(match.substring(1)));
  };

  const buildGraphData = (
    issues: GitHubIssue[],
    commentsMap: Map<number, GitHubComment[]>
  ) => {
    // Create nodes and edges first
    const nodes: Node[] = [];
    const edges: Array<{ id: string; source: string; target: string }> = [];
    const issueMap = new Map<number, GitHubIssue>();
    const inDegreeCount = new Map<string, number>();

    // Create a map of all issues for quick lookup
    issues.forEach((issue) => {
      issueMap.set(issue.number, issue);
      // Initialize in-degree count for each issue
      inDegreeCount.set(`${issue.number}`, 0);
    });

    // Create nodes and collect edges
    issues.forEach((issue) => {
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
          authorAvatar: issue.user.avatar_url,
        },
      });

      // Find references in issue body and comments
      const bodyRefs = findIssueReferences(issue.body || "");
      const comments = commentsMap.get(issue.number) || [];
      const commentRefs = comments.flatMap((comment) =>
        findIssueReferences(comment.body)
      );
      const allRefs = [...new Set([...bodyRefs, ...commentRefs])];

      // Create edges and count incoming references
      allRefs.forEach((refNumber) => {
        if (issueMap.has(refNumber) && refNumber !== issue.number) {
          const refId = `${refNumber}`;
          edges.push({
            id: `${issueId}-${refId}`,
            source: issueId,
            target: refId,
          });
          // Increment in-degree count for the target node
          inDegreeCount.set(refId, (inDegreeCount.get(refId) || 0) + 1);
        }
      });
    });

    // Update node sizes based on in-degree
    nodes.forEach((node) => {
      const inDegree = inDegreeCount.get(node.id) || 0;
      node.size = Math.max(1, inDegree + 1); // Add 1 to make sure even nodes with no incoming edges are visible
    });

    return { nodes, edges };
  };

  const fetchWithAuth = (url: string) => {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
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
        toast(
          "Request limit reached. Please provide a GitHub token to fetch more issues.",
          {
            icon: "⚠️",
            duration: 4000,
          }
        );
        break;
      }

      requestCount++;
      const response = await fetchWithAuth(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${per_page}&page=${page}`
      );

      if (!response.ok) {
        // Check for rate limit exceeded
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get(
            "x-ratelimit-remaining"
          );
          if (rateLimitRemaining === "0") {
            const resetTime = new Date(
              Number(response.headers.get("x-ratelimit-reset")) * 1000
            );
            throw new Error(
              `GitHub API rate limit exceeded. Rate limit will reset at ${resetTime.toLocaleString()}`
            );
          }
        }
        throw new Error("Failed to fetch issues");
      }

      const issues = await response.json();
      if (issues.length === 0) break;

      allIssues = [...allIssues, ...issues];
      page++;

      // Add a loading toast to show progress
      toast.loading(`Loaded ${allIssues.length} issues...`, {
        id: "loading-issues",
      });

      // Check remaining rate limit
      const rateLimitRemaining = Number(
        response.headers.get("x-ratelimit-remaining")
      );
      if (rateLimitRemaining <= 1) {
        // Leave 1 request as buffer
        toast(
          "Approaching rate limit. Please provide a GitHub token to fetch more issues.",
          {
            icon: "⚠️",
            duration: 4000,
          }
        );
        break;
      }
    }

    // Dismiss the loading toast
    toast.dismiss("loading-issues");

    return allIssues;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGitHubUrl(repoUrl)) {
      toast.error("Please enter a valid GitHub repository URL");
      return;
    }

    setLoading(true);
    try {
      const { owner, repo } = extractRepoInfo(repoUrl);

      // Show warning if no token is provided and we haven't shown it before
      if (!token && !hasShownWarning.current) {
        hasShownWarning.current = true;
        toast(
          "No GitHub token provided. You will be limited to 60 requests per hour. For higher limits, please provide a GitHub token.",
          {
            icon: "⚠️",
            duration: 6000,
          }
        );

        // Show additional rate limit info
        toast(
          "Without a token: 60 requests/hour\nWith a token: 5,000 requests/hour",
          {
            icon: "ℹ️",
            duration: 6000,
          }
        );
      }

      // Fetch all issues with pagination
      const issuesData = await fetchAllIssues(owner, repo);
      setIssues(issuesData);

      // Fetch comments for each issue
      const commentsMap = new Map<number, GitHubComment[]>();
      const commentPromises = issuesData.map(async (issue: GitHubIssue) => {
        // Skip if we're approaching the rate limit for non-token users
        if (!token && commentsMap.size >= 58) {
          // Leave 2 requests as buffer
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
        toast.success(
          `Loaded ${issuesData.length} issues (limited due to no token)`
        );
      } else {
        toast.success(`Loaded ${issuesData.length} issues successfully`);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to fetch repository data");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col">
      <Toaster position="top-right" />
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 text-white py-3 px-4 
        shadow-lg border-b border-gray-800/60 relative z-30">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
              GitHub Issues Graph
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <div className="relative group">
                <input
                  type="text"
                  id="repoUrl"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-[360px] rounded-lg border transition-all duration-200
                    dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-400 
                    bg-white/90 border-gray-300 text-gray-900 placeholder-gray-500
                    py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    hover:bg-white dark:hover:bg-gray-800/70"
                  required
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 
                  group-hover:opacity-10 transition-opacity duration-200 pointer-events-none" />
              </div>

              <div className="relative group">
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="GitHub Token (Optional)"
                  className="w-[300px] rounded-lg border transition-all duration-200
                    dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-400
                    bg-white/90 border-gray-300 text-gray-900 placeholder-gray-500
                    py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    hover:bg-white dark:hover:bg-gray-800/70"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 
                  group-hover:opacity-10 transition-opacity duration-200 pointer-events-none" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`relative overflow-hidden rounded-lg px-5 py-2 font-medium text-white
                  transition-all duration-200 
                  ${loading ? 
                    'bg-gray-600 cursor-not-allowed' : 
                    'bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/25'
                  }`}
              >
                <span className="relative z-10">
                  {loading ? "Loading..." : "Load"}
                </span>
              </button>
            </form>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:bg-gray-800/70 
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <FiSun className="w-5 h-5 text-yellow-400" />
              ) : (
                <FiMoon className="w-5 h-5 text-indigo-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] dark:bg-gray-900 relative z-20">
        {graphData.nodes.length > 0 && (
          <div className="h-full">
            <GraphVisualization
              graphData={graphData}
              onNodeHover={(node) => {
                if (node) {
                  setHoveredNode({
                    data: node,
                    mouseX: 0,
                    mouseY: 0,
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

      {/* Version footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 p-2 text-xs opacity-50 hover:opacity-100 transition-opacity duration-200">
        <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {__VERSION__}-{__GIT_HASH__}
        </span>
      </div>
    </div>
  );
}

export default App;
