export type ParamNode = { kind: "core/lambda_param"; __id: number; name: string };
export type Lambda = { param: ParamNode; body: Node };
export type Node =
  | { kind: "core/literal"; value: unknown }
  | ParamNode
  | { kind: "core/tuple"; elements: Node[] }
  | { kind: "num/add"; left: Node; right: Node }
  | { kind: "spike/invoke"; lambda: Lambda; arg: Node }
  | { kind: "spike/par_map"; collection: Node; param: ParamNode; body: Node }
  | { kind: "spike/try"; expr: Node; catch: { param: ParamNode; body: Node } }
  | { kind: "spike/throw"; error: Node }
  | { kind: "spike/counted"; id: string; value: unknown }
  | { kind: "core/apply_lambda"; param: ParamNode; body: Node; arg: Node };

export type Counters = Map<string, number>;

export function param(id: number, name: string): ParamNode {
  return { kind: "core/lambda_param", __id: id, name };
}

export function inc(counters: Counters, key: string): void {
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function lookupScope(frames: Map<number, unknown>[], id: number): unknown {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].has(id)) return frames[i].get(id);
  }
  throw new Error(`Unbound lambda param id=${id}`);
}
