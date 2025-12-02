/**
 * Graph - 오디오 라우팅 그래프 시스템
 *
 * 주요 기능:
 * - Route 간 의존성 관리
 * - 처리 순서 결정 (Topological Sort)
 * - 순환 참조 방지
 * - 동적 연결/해제
 */

import type { Route } from './Route';

/**
 * GraphNode - 그래프의 노드
 * Route를 래핑하여 그래프 구조에서 사용
 */
export class GraphNode {
  public route: Route;
  public dependencies: Set<GraphNode> = new Set(); // 이 노드가 의존하는 노드들
  public dependents: Set<GraphNode> = new Set(); // 이 노드를 의존하는 노드들
  public processed: boolean = false;

  constructor(route: Route) {
    this.route = route;
  }

  /**
   * 의존성 추가
   */
  addDependency(node: GraphNode): void {
    this.dependencies.add(node);
    node.dependents.add(this);
  }

  /**
   * 의존성 제거
   */
  removeDependency(node: GraphNode): void {
    this.dependencies.delete(node);
    node.dependents.delete(this);
  }

  /**
   * 모든 의존성 제거
   */
  clearDependencies(): void {
    this.dependencies.forEach(dep => {
      dep.dependents.delete(this);
    });
    this.dependencies.clear();
  }
}

/**
 * Graph - 오디오 라우팅 그래프
 * Route들의 처리 순서를 결정하고 순환 참조를 방지
 */
export class Graph {
  private nodes: Map<Route, GraphNode> = new Map();
  private sortedNodes: GraphNode[] = []; // 위상 정렬된 노드 목록
  private needsResort: boolean = true;

  /**
   * Route 추가
   */
  addRoute(route: Route): GraphNode {
    if (this.nodes.has(route)) {
      return this.nodes.get(route)!;
    }

    const node = new GraphNode(route);
    this.nodes.set(route, node);
    this.needsResort = true;
    return node;
  }

  /**
   * Route 제거
   */
  removeRoute(route: Route): void {
    const node = this.nodes.get(route);
    if (!node) {
      return;
    }

    // 모든 의존성 제거
    node.clearDependencies();

    // dependents에서도 제거
    node.dependents.forEach(dependent => {
      dependent.dependencies.delete(node);
    });

    this.nodes.delete(route);
    this.needsResort = true;
  }

  /**
   * Route 간 연결 추가 (의존성 추가)
   * fromRoute -> toRoute (fromRoute가 toRoute에 입력을 보냄)
   */
  addConnection(fromRoute: Route, toRoute: Route): void {
    const fromNode = this.nodes.get(fromRoute);
    const toNode = this.nodes.get(toRoute);

    if (!fromNode || !toNode) {
      throw new Error('Route not found in graph');
    }

    // 순환 참조 체크
    if (this.wouldCreateCycle(fromNode, toNode)) {
      throw new Error(
        `Connection would create a cycle: ${fromRoute.getName()} -> ${toRoute.getName()}`
      );
    }

    toNode.addDependency(fromNode);
    this.needsResort = true;
  }

  /**
   * Route 간 연결 제거
   */
  removeConnection(fromRoute: Route, toRoute: Route): void {
    const fromNode = this.nodes.get(fromRoute);
    const toNode = this.nodes.get(toRoute);

    if (!fromNode || !toNode) {
      return;
    }

    toNode.removeDependency(fromNode);
    this.needsResort = true;
  }

  /**
   * 순환 참조가 생성되는지 확인
   */
  private wouldCreateCycle(fromNode: GraphNode, toNode: GraphNode): boolean {
    // toNode에서 fromNode로 도달 가능한지 확인
    const visited = new Set<GraphNode>();
    const stack: GraphNode[] = [toNode];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === fromNode) {
        return true; // 순환 발견
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      // 모든 의존성을 스택에 추가
      current.dependencies.forEach(dep => {
        if (!visited.has(dep)) {
          stack.push(dep);
        }
      });
    }

    return false;
  }

  /**
   * 위상 정렬 (Topological Sort)
   * 의존성 순서에 따라 노드를 정렬
   */
  private topologicalSort(): GraphNode[] {
    const sorted: GraphNode[] = [];
    const inDegree = new Map<GraphNode, number>();
    const queue: GraphNode[] = [];

    // 각 노드의 진입 차수 계산
    this.nodes.forEach(node => {
      inDegree.set(node, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(node);
      }
    });

    // Kahn's Algorithm
    while (queue.length > 0) {
      const node = queue.shift()!;
      sorted.push(node);

      // 이 노드를 의존하는 노드들의 진입 차수 감소
      node.dependents.forEach(dependent => {
        const degree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, degree);

        if (degree === 0) {
          queue.push(dependent);
        }
      });
    }

    // 순환 참조가 있으면 일부 노드가 정렬되지 않음
    if (sorted.length !== this.nodes.size) {
      throw new Error('Graph contains cycles');
    }

    return sorted;
  }

  /**
   * 정렬된 Route 목록 가져오기
   */
  getSortedRoutes(): Route[] {
    if (this.needsResort) {
      this.sortedNodes = this.topologicalSort();
      this.needsResort = false;
    }

    return this.sortedNodes.map(node => node.route);
  }

  /**
   * 그래프 재정렬 강제
   */
  resort(): void {
    this.needsResort = true;
  }

  /**
   * 모든 Route 가져오기
   */
  getRoutes(): Route[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Route의 GraphNode 가져오기
   */
  getNode(route: Route): GraphNode | null {
    return this.nodes.get(route) || null;
  }

  /**
   * 그래프 비우기
   */
  clear(): void {
    this.nodes.forEach(node => node.clearDependencies());
    this.nodes.clear();
    this.sortedNodes = [];
    this.needsResort = true;
  }

  /**
   * 그래프 구조 검증
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 순환 참조 확인
    try {
      this.topologicalSort();
    } catch (error) {
      errors.push('Graph contains cycles');
    }

    // 고아 노드 확인 (의존성도 없고 dependent도 없는 노드)
    this.nodes.forEach(node => {
      if (node.dependencies.size === 0 && node.dependents.size === 0) {
        // 고아 노드는 문제가 아니지만, 경고는 할 수 있음
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 그래프 구조를 문자열로 출력 (디버깅용)
   */
  toString(): string {
    const lines: string[] = [];
    lines.push('Graph Structure:');

    this.nodes.forEach((node, route) => {
      const deps = Array.from(node.dependencies)
        .map(dep => dep.route.getName())
        .join(', ');
      lines.push(`  ${route.getName()} -> [${deps || 'none'}]`);
    });

    return lines.join('\n');
  }
}
