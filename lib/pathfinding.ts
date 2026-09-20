import { loadLocation } from './world';

interface Graph {
  nodes: [number, number][];
  adjacency: { to: number; dist: number }[][];
}

let cachedGraph: Graph | null = null;

function keyOf(p: [number, number]): string {
  return `${Math.round(p[0] * 10)}_${Math.round(p[1] * 10)}`;
}

function buildGraph(): Graph {
  const loc = loadLocation();
  const nodeIndex = new Map<string, number>();
  const nodes: [number, number][] = [];
  const adjacency: { to: number; dist: number }[][] = [];

  function nodeId(p: [number, number]): number {
    const k = keyOf(p);
    let id = nodeIndex.get(k);
    if (id === undefined) {
      id = nodes.length;
      nodes.push(p);
      adjacency.push([]);
      nodeIndex.set(k, id);
    }
    return id;
  }

  for (const seg of loc.paths ?? []) {
    const a = nodeId(seg.from);
    const b = nodeId(seg.to);
    const d = Math.hypot(seg.from[0] - seg.to[0], seg.from[1] - seg.to[1]);
    adjacency[a].push({ to: b, dist: d });
    adjacency[b].push({ to: a, dist: d });
  }

  return { nodes, adjacency };
}

function getGraph(): Graph {
  if (!cachedGraph) cachedGraph = buildGraph();
  return cachedGraph;
}

function nearestNode(graph: Graph, p: { x: number; y: number }): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const [nx, ny] = graph.nodes[i];
    const d = Math.hypot(nx - p.x, ny - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Plain O(V^2) Dijkstra — the road graph only has a few dozen nodes, so this is plenty fast. */
function shortestPath(graph: Graph, startNode: number, endNode: number): number[] {
  const dist = new Map<number, number>([[startNode, 0]]);
  const prev = new Map<number, number>();
  const remaining = new Set(graph.nodes.map((_, i) => i));

  while (remaining.size) {
    let u = -1;
    let best = Infinity;
    for (const n of remaining) {
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === -1) break;
    remaining.delete(u);
    if (u === endNode) break;

    for (const edge of graph.adjacency[u] ?? []) {
      const alt = (dist.get(u) ?? Infinity) + edge.dist;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
      }
    }
  }

  if (!dist.has(endNode)) return [];
  const path: number[] = [];
  let cur: number | undefined = endNode;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

/**
 * A waypoint list from `from` to `to` that follows the island's road network
 * instead of cutting straight across the grass: nearest road node to `from`,
 * along the graph to the node nearest `to`, then the final off-road stretch
 * to the exact destination (landmarks, farm beds, plot centroids etc. aren't
 * themselves on the road graph, so there's always a short "last mile").
 */
export function findRoute(from: { x: number; y: number }, to: { x: number; y: number }): [number, number][] {
  const graph = getGraph();
  if (graph.nodes.length === 0) return [[to.x, to.y]];

  const startNode = nearestNode(graph, from);
  const endNode = nearestNode(graph, to);
  const nodePath = startNode === endNode ? [startNode] : shortestPath(graph, startNode, endNode);
  const waypoints: [number, number][] = nodePath.map((i) => graph.nodes[i]);

  // Drop leading waypoints that are basically where we're already standing.
  while (waypoints.length && Math.hypot(waypoints[0][0] - from.x, waypoints[0][1] - from.y) < 2) {
    waypoints.shift();
  }

  const last = waypoints[waypoints.length - 1];
  if (!last || Math.hypot(last[0] - to.x, last[1] - to.y) > 0.5) {
    waypoints.push([to.x, to.y]);
  }

  return waypoints.length ? waypoints : [[to.x, to.y]];
}
