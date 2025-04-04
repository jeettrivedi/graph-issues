import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Node } from './GraphVisualization';

interface IssueModalProps {
  issue: Node | null;
  darkMode: boolean;
  onClose: () => void;
}

const IssueModal: React.FC<IssueModalProps> = ({
  issue,
  darkMode,
  onClose,
}) => {
  if (!issue) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`fixed left-4 top-20 h-[calc(100vh-6rem)] w-96 transform transition-transform duration-300 ease-in-out rounded-xl z-10 ${
        issue ? 'translate-x-0' : '-translate-x-full'
      } ${
        darkMode
          ? 'bg-gray-800 text-white shadow-2xl border border-gray-700'
          : 'bg-white text-gray-900 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200'
      }`}
    >
      <div className="p-6 h-full overflow-y-auto pb-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">
            Issue #{issue.attributes.number}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-opacity-10 ${
              darkMode ? 'hover:bg-white' : 'hover:bg-black'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">
            {issue.attributes.title}
          </h3>
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`px-2 py-1 rounded-full text-sm ${
                issue.attributes.state === 'open'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {issue.attributes.state}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDate(issue.attributes.createdAt)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={issue.attributes.authorAvatar}
              alt={issue.attributes.author}
              className="w-6 h-6 rounded-full"
            />
            <span className="font-medium">{issue.attributes.author}</span>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-semibold mb-2">Labels</h4>
          <div className="flex flex-wrap gap-2">
            {issue.attributes.labels.map((label, index) => (
              <span
                key={index}
                className="px-2 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: `#${label.color}20`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-semibold mb-2">Description</h4>
          <div className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}>
            {issue.attributes.body ? (
              <ReactMarkdown
                components={{
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <code
                        className={`${className} block p-4 rounded-md bg-gray-100 dark:bg-gray-700`}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className={`${className} px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700`}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  a: ({ children, href, ...props }) => (
                    <a
                      href={href}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {issue.attributes.body}
              </ReactMarkdown>
            ) : (
              'No description provided.'
            )}
          </div>
        </div>

        <a
          href={issue.attributes.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block px-4 py-2 rounded-md ${
            darkMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
};

export default IssueModal;
