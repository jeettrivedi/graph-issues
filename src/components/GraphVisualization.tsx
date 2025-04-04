import React, { useEffect, useRef, useState } from 'react';
import {
  SigmaContainer,
  ControlsContainer,
  ZoomControl,
  FullScreenControl,
  useLoadGraph,
  useSigma,
  useRegisterEvents,
  useSetSettings,
} from '@react-sigma/core';
import { DirectedGraph } from 'graphology';
import '@react-sigma/core/lib/style.css';
import { LayoutForceAtlas2Control } from '@react-sigma/layout-forceatlas2';
import IssueModal from './IssueModal';
import { useLayoutCircular } from '@react-sigma/layout-circular';

export interface Node {
  id: string;
  label: string;
  size: number;
  attributes: {
    number: number;
    title: string;
    state: string;
    createdAt: string;
    author: string;
    authorAvatar: string;
    labels: Array<{ name: string; color: string }>;
    body: string;
    url: string;
  };
}

export interface Edge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface GraphVisualizationProps {
  graphData: GraphData;
  onNodeHover: (node: Node | null) => void;
  onNodeClick: (node: Node | null) => void;
  darkMode: boolean;
}

const LoadGraph: React.FC<{
  graphData: GraphData;
  onNodeHover: (node: Node | null) => void;
  onNodeClick: (node: Node | null) => void;
  darkMode: boolean;
}> = ({ graphData, onNodeHover, onNodeClick, darkMode }) => {
  const loadGraph = useLoadGraph();
  const { assign } = useLayoutCircular();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const prevGraphDataRef = useRef<string>('');

  // Reset and initialize graph when graphData changes
  useEffect(() => {
    // Create a string representation of the graph data to compare
    const currentGraphDataStr = JSON.stringify(graphData);

    // Only recreate the graph if the data has changed
    if (currentGraphDataStr !== prevGraphDataRef.current) {
      const graph = new DirectedGraph();

      graphData.nodes.forEach((node) => {
        // Add random initial positions to spread nodes out
        const x = 0;
        const y = 0;

        graph.addNode(node.id, {
          label: node.label,
          size: node.size * 4,
          x,
          y,
          attributes: node.attributes,
        });
      });

      graphData.edges.forEach((edge) => {
        graph.addDirectedEdge(edge.source, edge.target, {
          size: 2,
          color: darkMode ? '#4B5563' : '#666',
          type: 'arrow',
        });
      });

      loadGraph(graph);
      assign();
      prevGraphDataRef.current = currentGraphDataStr;
    }
  }, [graphData, assign, loadGraph, darkMode]);

  // Update edge colors when dark mode changes
  useEffect(() => {
    const graph = sigma.getGraph();
    if (!graph) return;

    graph.forEachEdge((edge) => {
      graph.setEdgeAttribute(edge, 'color', darkMode ? '#4B5563' : '#666');
    });
  }, [darkMode, sigma]);

  useEffect(() => {
    registerEvents({
      // Use the correct event names from Sigma
      enterNode: (event) => {
        const node = event.node;
        if (node) {
          const nodeData = sigma.getGraph().getNodeAttributes(node);
          onNodeHover({
            id: node,
            label: nodeData.label,
            size: nodeData.size,
            attributes: nodeData.attributes,
          });
        } else {
          onNodeHover(null);
        }
      },
      leaveNode: () => {
        onNodeHover(null);
      },
      clickNode: (event) => {
        const node = event.node;
        if (node) {
          const nodeData = sigma.getGraph().getNodeAttributes(node);
          onNodeClick({
            id: node,
            label: nodeData.label,
            size: nodeData.size,
            attributes: nodeData.attributes,
          });
        } else {
          onNodeClick(null);
        }
      },
    });
  }, [registerEvents, sigma, onNodeHover, onNodeClick]);

  useEffect(() => {
    setSettings({
      renderLabels: false,
      labelColor: {
        color: 'black',
      },
      nodeReducer: (_node, data) => {
        const res = { ...data };
        const firstLabel = data.attributes.labels[0];
        if (firstLabel) {
          res.color = `#${firstLabel.color}`;
        } else {
          res.color = '#000000';
        }
        // Add border color based on dark mode
        res.borderColor = darkMode ? '#ffffff' : '#000000';
        res.borderSize = 10;
        return res;
      },
      edgeReducer: (_edge, data) => {
        return {
          ...data,
          color: darkMode ? '#4B5563' : '#666',
          type: 'arrow',
          size: 1,
        };
      },
    });
  }, [setSettings, darkMode]);

  return null;
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graphData,
  onNodeHover,
  onNodeClick,
  darkMode,
}) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const forceAtlasSettings = {
    settings: {
      slowDown: 1000,
      gravity: 2,
      outboundAttractionDistribution: true,
    },
  };

  const handleNodeClick = (node: Node | null) => {
    setSelectedNode(node);
    onNodeClick(node);
  };

  const containerClasses =
    'flex flex-col gap-2 p-2 backdrop-blur-sm dark:border dark:border-gray-600 bg-white/80 border border-black/10';

  const buttonClasses =
    'p-2 rounded-md cursor-pointer flex items-center justify-center transition-all duration-200 dark:border bg-white/80 border border-black/10';

  return (
    <div className="w-full h-full">
      <SigmaContainer className="h-full w-full dark:bg-gray-900 bg-white">
        <LoadGraph
          graphData={graphData}
          onNodeHover={onNodeHover}
          onNodeClick={handleNodeClick}
          darkMode={darkMode}
        />
        <ControlsContainer position="bottom-right" className={containerClasses}>
          <ZoomControl className={buttonClasses} />
          <LayoutForceAtlas2Control
            className={buttonClasses}
            settings={forceAtlasSettings}
          />
          <FullScreenControl className={buttonClasses} />
        </ControlsContainer>
      </SigmaContainer>
      <IssueModal
        issue={selectedNode}
        darkMode={darkMode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
};

export default GraphVisualization;
