import React, { useMemo } from "react";
import { SigmaContainer } from "@react-sigma/core";
import Graph from "graphology";
import "@react-sigma/core/lib/style.css";

export interface Node {
  id: string;
  label: string;
  size: number;
  attributes: {
    title: string;
    body: string;
    state: string;
    createdAt: string;
    number: number;
    labels: Array<{ name: string; color: string }>;
    url: string;
    author: string;
    authorAvatar: string;
  };
}

interface Edge {
  id: string;
  source: string;
  target: string;
}

interface GraphVisualizationProps {
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
  onNodeHover: (node: Node | null) => void;
  onNodeClick: (node: Node | null) => void;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graphData,
  onNodeHover,
  onNodeClick,
}) => {
  // Create graph instance
  const graph = useMemo(() => {
    const g = new Graph();

    // Calculate positions first
    const radius = 100;
    const positions = graphData.nodes.map((_, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      };
    });

    // Add nodes with positions
    graphData.nodes.forEach((node, i) => {
      g.addNode(node.id, {
        label: node.label,
        size: node.size,
        x: positions[i].x,
        y: positions[i].y,
        attributes: node.attributes
      });
    });

    // Add edges
    graphData.edges.forEach((edge) => {
      g.addEdge(edge.source, edge.target);
    });

    return g;
  }, [graphData]);

  const settings = {
    labelColor: { color: "#000000" },
    labelSize: 14,
    labelWeight: "bold",
    defaultNodeColor: "#6366f1",
    defaultEdgeColor: "#94a3b8",
    renderEdgeLabels: true,
    edgeLabelSize: 12,
    nodeReducer: (node: string) => {
      const data = graph.getNodeAttributes(node);
      const firstLabel = data.attributes.labels[0];
      const nodeColor = firstLabel ? `#${firstLabel.color}` : data.attributes.state === "open" ? "#22c55e" : "#ef4444";
      return {
        x: data.x,
        y: data.y,
        size: data.size * 4,
        label: data.label,
        color: nodeColor,
      };
    },
    edgeReducer: () => ({
      size: 2,
      color: "#94a3b8",
      type: "arrow",
      label: "",
    }),
  };

  return (
    <div className="w-full h-full">
      <SigmaContainer
        graph={graph}
        settings={settings}
        className="w-full h-full"
      />
    </div>
  );
};

export default GraphVisualization;
