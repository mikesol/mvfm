/**
 * TypeScript type parser for Slack SDK response .d.ts files.
 *
 * Extracted from the spike at plugin-slack/scripts/spike-fastcheck.ts.
 * Uses the TypeScript compiler API to walk a single .d.ts file and collect
 * interfaces, enums, and type aliases into a structured TypeModel.
 */
import * as ts from "typescript";

/** A field within an interface or object literal. */
export interface FieldModel {
  name: string;
  optional: boolean;
  type: TypeRef;
}

/** A parsed interface declaration. */
export interface InterfaceModel {
  name: string;
  fields: FieldModel[];
}

/** The complete type model extracted from a single response file. */
export interface TypeModel {
  interfaces: Map<string, InterfaceModel>;
  enums: Map<string, string[]>;
  typeAliases: Map<string, TypeRef>;
}

/** Discriminated union representing all supported TypeScript type shapes. */
export type TypeRef =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "any" }
  | { kind: "null" }
  | { kind: "undefined" }
  | { kind: "array"; element: TypeRef }
  | { kind: "ref"; name: string }
  | { kind: "union"; members: TypeRef[] }
  | { kind: "intersection"; members: TypeRef[] }
  | { kind: "record"; keyType: TypeRef; valueType: TypeRef }
  | { kind: "object-literal"; fields: FieldModel[] }
  | { kind: "unknown" };

/**
 * Parse a single .d.ts response file into a TypeModel.
 * @param filePath - Absolute path to the .d.ts file
 */
export function parseResponseFile(filePath: string): TypeModel {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.Latest,
  });
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) throw new Error(`Could not parse ${filePath}`);

  const model: TypeModel = {
    interfaces: new Map(),
    enums: new Map(),
    typeAliases: new Map(),
  };

  function resolveTypeRef(node: ts.TypeNode): TypeRef {
    if (ts.isTypeReferenceNode(node)) {
      const name = node.typeName.getText(sourceFile!);
      if (name === "Array" && node.typeArguments?.[0]) {
        return { kind: "array", element: resolveTypeRef(node.typeArguments[0]) };
      }
      return { kind: "ref", name };
    }
    if (node.kind === ts.SyntaxKind.StringKeyword) return { kind: "string" };
    if (node.kind === ts.SyntaxKind.NumberKeyword) return { kind: "number" };
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return { kind: "boolean" };
    if (node.kind === ts.SyntaxKind.AnyKeyword) return { kind: "any" };
    if (node.kind === ts.SyntaxKind.NullKeyword) return { kind: "null" };
    if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
      return { kind: "undefined" };
    }
    if (ts.isArrayTypeNode(node)) {
      return { kind: "array", element: resolveTypeRef(node.elementType) };
    }
    if (ts.isUnionTypeNode(node)) {
      return { kind: "union", members: node.types.map(resolveTypeRef) };
    }
    if (ts.isIntersectionTypeNode(node)) {
      return { kind: "intersection", members: node.types.map(resolveTypeRef) };
    }
    if (ts.isTypeLiteralNode(node)) {
      return resolveTypeLiteral(node);
    }
    return { kind: "unknown" };
  }

  function resolveTypeLiteral(node: ts.TypeLiteralNode): TypeRef {
    const indexSig = node.members.find(ts.isIndexSignatureDeclaration);
    if (indexSig && ts.isIndexSignatureDeclaration(indexSig)) {
      const keyParam = indexSig.parameters[0];
      const keyType = keyParam?.type
        ? resolveTypeRef(keyParam.type)
        : ({ kind: "string" } as const);
      const valueType = indexSig.type
        ? resolveTypeRef(indexSig.type)
        : ({ kind: "any" } as const);
      return { kind: "record", keyType, valueType };
    }
    const fields: FieldModel[] = [];
    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name && member.type) {
        fields.push({
          name: member.name.getText(sourceFile!),
          optional: !!member.questionToken,
          type: resolveTypeRef(member.type),
        });
      }
    }
    return { kind: "object-literal", fields };
  }

  function visitNode(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      const fields: FieldModel[] = [];
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && member.type) {
          fields.push({
            name: member.name.getText(sourceFile!),
            optional: !!member.questionToken,
            type: resolveTypeRef(member.type),
          });
        }
      }
      model.interfaces.set(node.name.text, {
        name: node.name.text,
        fields,
      });
    }
    if (ts.isTypeAliasDeclaration(node)) {
      model.typeAliases.set(node.name.text, resolveTypeRef(node.type));
    }
    if (ts.isEnumDeclaration(node)) {
      const values: string[] = [];
      for (const member of node.members) {
        if (member.initializer && ts.isStringLiteral(member.initializer)) {
          values.push(member.initializer.text);
        }
      }
      model.enums.set(node.name.text, values);
    }
    ts.forEachChild(node, visitNode);
  }

  ts.forEachChild(sourceFile, visitNode);
  return model;
}
