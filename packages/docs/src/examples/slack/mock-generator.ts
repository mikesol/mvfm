/**
 * Mock data generator for Slack SDK response types.
 *
 * Extracted from the spike at plugin-slack/scripts/spike-fastcheck.ts.
 * Walks a TypeModel and produces maximalist mock data using field heuristics.
 */
import { faker } from "@faker-js/faker";
import { fakeString, fakeNumber, singularize } from "./field-heuristics.js";
import type { TypeModel, TypeRef, FieldModel, InterfaceModel } from "./type-parser.js";

const MAX_DEPTH = 5;

function generate(
  typeRef: TypeRef,
  model: TypeModel,
  visited: Set<string>,
  depth: number,
  fieldName?: string,
): unknown {
  switch (typeRef.kind) {
    case "string":
      return fakeString(fieldName ?? "");
    case "number":
      return fakeNumber(fieldName ?? "");
    case "boolean":
      return faker.datatype.boolean();
    case "any":
      return null;
    case "null":
      return null;
    case "undefined":
      return undefined;

    case "array": {
      if (depth >= MAX_DEPTH) return [];
      const count = faker.number.int({ min: 1, max: 2 });
      // Propagate parent field name into primitive array elements
      // so `channels: string[]` -> channel IDs, `editors: string[]` -> user IDs, etc.
      const elemName =
        typeRef.element.kind === "string" || typeRef.element.kind === "number"
          ? singularize(fieldName)
          : undefined;
      return Array.from({ length: count }, () =>
        generate(typeRef.element, model, new Set(visited), depth + 1, elemName),
      );
    }

    case "ref": {
      const name = typeRef.name;

      if (model.enums.has(name)) {
        const values = model.enums.get(name)!;
        return faker.helpers.arrayElement(values);
      }

      if (model.typeAliases.has(name)) {
        if (visited.has(name) || depth >= MAX_DEPTH) return {};
        const next = new Set(visited);
        next.add(name);
        return generate(model.typeAliases.get(name)!, model, next, depth + 1);
      }

      if (model.interfaces.has(name)) {
        if (visited.has(name) || depth >= MAX_DEPTH) return {};
        const next = new Set(visited);
        next.add(name);
        return generateInterface(model.interfaces.get(name)!, model, next, depth + 1);
      }

      // External ref (e.g. WebAPICallResult) -- skip
      return {};
    }

    case "union": {
      const nonNull = typeRef.members.filter(
        (m) => m.kind !== "null" && m.kind !== "undefined",
      );
      if (nonNull.length === 0) return null;
      // Pick the first non-null member (deterministic, and usually the most interesting)
      return generate(nonNull[0], model, visited, depth, fieldName);
    }

    case "intersection": {
      const result: Record<string, unknown> = {};
      for (const member of typeRef.members) {
        const val = generate(member, model, visited, depth, fieldName);
        if (val && typeof val === "object" && !Array.isArray(val)) {
          Object.assign(result, val);
        }
      }
      return result;
    }

    case "record": {
      if (depth >= MAX_DEPTH) return {};
      const result: Record<string, unknown> = {};
      const keys = [faker.string.alphanumeric(8), faker.string.alphanumeric(8)];
      for (const key of keys) {
        result[key] = generate(typeRef.valueType, model, visited, depth + 1);
      }
      return result;
    }

    case "object-literal": {
      return generateFields(typeRef.fields, model, visited, depth);
    }

    case "unknown":
      return null;
  }
}

function generateFields(
  fields: FieldModel[],
  model: TypeModel,
  visited: Set<string>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    // Maximalist: populate ALL fields
    const val = generate(field.type, model, new Set(visited), depth, field.name);
    if (val !== undefined) {
      result[field.name] = val;
    }
  }
  return result;
}

function generateInterface(
  iface: InterfaceModel,
  model: TypeModel,
  visited: Set<string>,
  depth: number,
): Record<string, unknown> {
  return generateFields(iface.fields, model, visited, depth);
}

/**
 * Generate a complete mock response for a named Slack response type.
 * @param responseName - The name of the response type (e.g. "ChatPostMessageResponse")
 * @param model - The parsed TypeModel from the corresponding .d.ts file
 */
export function generateResponse(
  responseName: string,
  model: TypeModel,
): unknown {
  const alias = model.typeAliases.get(responseName);
  if (alias) {
    return generate(alias, model, new Set(), 0);
  }
  const iface = model.interfaces.get(responseName);
  if (iface) {
    return generateInterface(iface, model, new Set(), 0);
  }
  throw new Error(`Response type ${responseName} not found`);
}
