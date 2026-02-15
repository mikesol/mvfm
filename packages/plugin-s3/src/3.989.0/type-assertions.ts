import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { Expr } from "@mvfm/core";
import type { S3Methods } from "./index";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type S3Api = S3Methods["s3"];

type _PutObjectInput = Expect<
  Equal<Parameters<S3Api["putObject"]>[0], Expr<PutObjectCommandInput> | PutObjectCommandInput>
>;
declare const _putObjectOutputActual: ReturnType<S3Api["putObject"]>;
const _putObjectOutputAsExpected: Expr<PutObjectCommandOutput> = _putObjectOutputActual;
const _putObjectOutputAsActual: ReturnType<S3Api["putObject"]> = {} as Expr<PutObjectCommandOutput>;

type _GetObjectInput = Expect<
  Equal<Parameters<S3Api["getObject"]>[0], Expr<GetObjectCommandInput> | GetObjectCommandInput>
>;
declare const _getObjectOutputActual: ReturnType<S3Api["getObject"]>;
const _getObjectOutputAsExpected: Expr<GetObjectCommandOutput> = _getObjectOutputActual;
const _getObjectOutputAsActual: ReturnType<S3Api["getObject"]> = {} as Expr<GetObjectCommandOutput>;
