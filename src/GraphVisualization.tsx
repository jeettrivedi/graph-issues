import React, {useEffect, FC} from "react";
import {
  SigmaContainer,
  ControlsContainer,
  ZoomControl,
  FullScreenControl,
  useLoadGraph
} from "@react-sigma/core";
import { DirectedGraph } from "graphology";
import "@react-sigma/core/lib/style.css";
import { useLayoutCircular } from "@react-sigma/layout-circular";
import { useLayoutRandom } from "@react-sigma/layout-random";
import { LayoutForceAtlas2Control } from '@react-sigma/layout-forceatlas2';

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

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface GraphVisualizationProps {
  graphData: GraphData;
  onNodeHover: (node: Node | null) => void;
  onNodeClick: (node: Node | null) => void;
}


// This component handles the graph loading and layout
const LoadGraph: FC<{ graphData: GraphData }> = ({ graphData }) => {

  const loadGraph = useLoadGraph();
  const { assign } = useLayoutRandom();
  useEffect(() => {
    // Create graph instance
    const graph = new DirectedGraph();

    // Add nodes
    graphData.nodes.forEach((node) => {
      graph.addNode(node.id, {
        label: node.label,
        size: node.size * 4,
        x: 0,
        y: 0,
        attributes: node.attributes
      });
    });

    // Add edges
    graphData.edges.forEach((edge) => {
      graph.addDirectedEdge(edge.source, edge.target);
    });

    // Load the graph and apply layout
    loadGraph(graph);
    assign();
  }, [graphData, loadGraph, assign]);

  return null;
};

const GraphVisualization: FC<GraphVisualizationProps> = ({
  graphData,
  onNodeHover,
  onNodeClick,
}) => {
  const settings = {
    labelColor: { color: "#000000" },
    labelSize: 14,
    labelWeight: "bold",
    defaultNodeColor: "#6366f1",
    defaultEdgeColor: "#94a3b8",
    renderEdgeLabels: false,
    edgeLabelSize: 12,
    nodeReducer: (node: string, data: any) => {
      const firstLabel = data.attributes.labels[0];
      const nodeColor = firstLabel ? `#${firstLabel.color}` : data.attributes.state === "open" ? "#22c55e" : "#ef4444";
      return {
        ...data,
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

  const forceAtlasSettings = {
    settings: {
      slowDown:100,
      gravity: 5,
    },
  };

  return (
    <div className="w-full h-full">
      <SigmaContainer
        settings={settings}
        className="w-full h-full"
      >
        <LoadGraph graphData={graphData} />
        <ControlsContainer position="bottom-right">
          <ZoomControl />
          <LayoutForceAtlas2Control settings={forceAtlasSettings} />
        </ControlsContainer>
        <ControlsContainer position="top-right">
          <FullScreenControl />
        </ControlsContainer>
      </SigmaContainer>
    </div>
  );
};

export default GraphVisualization;
