
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Tenant
 * 
 */
export type Tenant = $Result.DefaultSelection<Prisma.$TenantPayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model MetricsSession
 * 
 */
export type MetricsSession = $Result.DefaultSelection<Prisma.$MetricsSessionPayload>
/**
 * Model ToolMetric
 * 
 */
export type ToolMetric = $Result.DefaultSelection<Prisma.$ToolMetricPayload>
/**
 * Model DashboardConfig
 * 
 */
export type DashboardConfig = $Result.DefaultSelection<Prisma.$DashboardConfigPayload>
/**
 * Model ActivityData
 * 
 */
export type ActivityData = $Result.DefaultSelection<Prisma.$ActivityDataPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Tenants
 * const tenants = await prisma.tenant.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Tenants
   * const tenants = await prisma.tenant.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.tenant`: Exposes CRUD operations for the **Tenant** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Tenants
    * const tenants = await prisma.tenant.findMany()
    * ```
    */
  get tenant(): Prisma.TenantDelegate<ExtArgs>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs>;

  /**
   * `prisma.metricsSession`: Exposes CRUD operations for the **MetricsSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MetricsSessions
    * const metricsSessions = await prisma.metricsSession.findMany()
    * ```
    */
  get metricsSession(): Prisma.MetricsSessionDelegate<ExtArgs>;

  /**
   * `prisma.toolMetric`: Exposes CRUD operations for the **ToolMetric** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ToolMetrics
    * const toolMetrics = await prisma.toolMetric.findMany()
    * ```
    */
  get toolMetric(): Prisma.ToolMetricDelegate<ExtArgs>;

  /**
   * `prisma.dashboardConfig`: Exposes CRUD operations for the **DashboardConfig** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DashboardConfigs
    * const dashboardConfigs = await prisma.dashboardConfig.findMany()
    * ```
    */
  get dashboardConfig(): Prisma.DashboardConfigDelegate<ExtArgs>;

  /**
   * `prisma.activityData`: Exposes CRUD operations for the **ActivityData** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ActivityData
    * const activityData = await prisma.activityData.findMany()
    * ```
    */
  get activityData(): Prisma.ActivityDataDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Tenant: 'Tenant',
    User: 'User',
    MetricsSession: 'MetricsSession',
    ToolMetric: 'ToolMetric',
    DashboardConfig: 'DashboardConfig',
    ActivityData: 'ActivityData'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "tenant" | "user" | "metricsSession" | "toolMetric" | "dashboardConfig" | "activityData"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Tenant: {
        payload: Prisma.$TenantPayload<ExtArgs>
        fields: Prisma.TenantFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          findFirst: {
            args: Prisma.TenantFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          findMany: {
            args: Prisma.TenantFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>[]
          }
          create: {
            args: Prisma.TenantCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          createMany: {
            args: Prisma.TenantCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TenantCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>[]
          }
          delete: {
            args: Prisma.TenantDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          update: {
            args: Prisma.TenantUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          deleteMany: {
            args: Prisma.TenantDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          aggregate: {
            args: Prisma.TenantAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenant>
          }
          groupBy: {
            args: Prisma.TenantGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantCountArgs<ExtArgs>
            result: $Utils.Optional<TenantCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      MetricsSession: {
        payload: Prisma.$MetricsSessionPayload<ExtArgs>
        fields: Prisma.MetricsSessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MetricsSessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MetricsSessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          findFirst: {
            args: Prisma.MetricsSessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MetricsSessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          findMany: {
            args: Prisma.MetricsSessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>[]
          }
          create: {
            args: Prisma.MetricsSessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          createMany: {
            args: Prisma.MetricsSessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MetricsSessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>[]
          }
          delete: {
            args: Prisma.MetricsSessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          update: {
            args: Prisma.MetricsSessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          deleteMany: {
            args: Prisma.MetricsSessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MetricsSessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MetricsSessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MetricsSessionPayload>
          }
          aggregate: {
            args: Prisma.MetricsSessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMetricsSession>
          }
          groupBy: {
            args: Prisma.MetricsSessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<MetricsSessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.MetricsSessionCountArgs<ExtArgs>
            result: $Utils.Optional<MetricsSessionCountAggregateOutputType> | number
          }
        }
      }
      ToolMetric: {
        payload: Prisma.$ToolMetricPayload<ExtArgs>
        fields: Prisma.ToolMetricFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ToolMetricFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ToolMetricFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          findFirst: {
            args: Prisma.ToolMetricFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ToolMetricFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          findMany: {
            args: Prisma.ToolMetricFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>[]
          }
          create: {
            args: Prisma.ToolMetricCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          createMany: {
            args: Prisma.ToolMetricCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ToolMetricCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>[]
          }
          delete: {
            args: Prisma.ToolMetricDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          update: {
            args: Prisma.ToolMetricUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          deleteMany: {
            args: Prisma.ToolMetricDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ToolMetricUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ToolMetricUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ToolMetricPayload>
          }
          aggregate: {
            args: Prisma.ToolMetricAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateToolMetric>
          }
          groupBy: {
            args: Prisma.ToolMetricGroupByArgs<ExtArgs>
            result: $Utils.Optional<ToolMetricGroupByOutputType>[]
          }
          count: {
            args: Prisma.ToolMetricCountArgs<ExtArgs>
            result: $Utils.Optional<ToolMetricCountAggregateOutputType> | number
          }
        }
      }
      DashboardConfig: {
        payload: Prisma.$DashboardConfigPayload<ExtArgs>
        fields: Prisma.DashboardConfigFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DashboardConfigFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DashboardConfigFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          findFirst: {
            args: Prisma.DashboardConfigFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DashboardConfigFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          findMany: {
            args: Prisma.DashboardConfigFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>[]
          }
          create: {
            args: Prisma.DashboardConfigCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          createMany: {
            args: Prisma.DashboardConfigCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DashboardConfigCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>[]
          }
          delete: {
            args: Prisma.DashboardConfigDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          update: {
            args: Prisma.DashboardConfigUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          deleteMany: {
            args: Prisma.DashboardConfigDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DashboardConfigUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.DashboardConfigUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DashboardConfigPayload>
          }
          aggregate: {
            args: Prisma.DashboardConfigAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDashboardConfig>
          }
          groupBy: {
            args: Prisma.DashboardConfigGroupByArgs<ExtArgs>
            result: $Utils.Optional<DashboardConfigGroupByOutputType>[]
          }
          count: {
            args: Prisma.DashboardConfigCountArgs<ExtArgs>
            result: $Utils.Optional<DashboardConfigCountAggregateOutputType> | number
          }
        }
      }
      ActivityData: {
        payload: Prisma.$ActivityDataPayload<ExtArgs>
        fields: Prisma.ActivityDataFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ActivityDataFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ActivityDataFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          findFirst: {
            args: Prisma.ActivityDataFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ActivityDataFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          findMany: {
            args: Prisma.ActivityDataFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>[]
          }
          create: {
            args: Prisma.ActivityDataCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          createMany: {
            args: Prisma.ActivityDataCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ActivityDataCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>[]
          }
          delete: {
            args: Prisma.ActivityDataDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          update: {
            args: Prisma.ActivityDataUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          deleteMany: {
            args: Prisma.ActivityDataDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ActivityDataUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ActivityDataUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityDataPayload>
          }
          aggregate: {
            args: Prisma.ActivityDataAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateActivityData>
          }
          groupBy: {
            args: Prisma.ActivityDataGroupByArgs<ExtArgs>
            result: $Utils.Optional<ActivityDataGroupByOutputType>[]
          }
          count: {
            args: Prisma.ActivityDataCountArgs<ExtArgs>
            result: $Utils.Optional<ActivityDataCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    metricsSessions: number
    dashboardConfigs: number
    activities: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    metricsSessions?: boolean | UserCountOutputTypeCountMetricsSessionsArgs
    dashboardConfigs?: boolean | UserCountOutputTypeCountDashboardConfigsArgs
    activities?: boolean | UserCountOutputTypeCountActivitiesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMetricsSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MetricsSessionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountDashboardConfigsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DashboardConfigWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountActivitiesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ActivityDataWhereInput
  }


  /**
   * Count Type MetricsSessionCountOutputType
   */

  export type MetricsSessionCountOutputType = {
    toolMetrics: number
  }

  export type MetricsSessionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    toolMetrics?: boolean | MetricsSessionCountOutputTypeCountToolMetricsArgs
  }

  // Custom InputTypes
  /**
   * MetricsSessionCountOutputType without action
   */
  export type MetricsSessionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSessionCountOutputType
     */
    select?: MetricsSessionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * MetricsSessionCountOutputType without action
   */
  export type MetricsSessionCountOutputTypeCountToolMetricsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ToolMetricWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Tenant
   */

  export type AggregateTenant = {
    _count: TenantCountAggregateOutputType | null
    _min: TenantMinAggregateOutputType | null
    _max: TenantMaxAggregateOutputType | null
  }

  export type TenantMinAggregateOutputType = {
    id: string | null
    name: string | null
    domain: string | null
    schemaName: string | null
    subscriptionPlan: string | null
    createdAt: Date | null
    updatedAt: Date | null
    isActive: boolean | null
    adminEmail: string | null
    billingEmail: string | null
    dataRegion: string | null
  }

  export type TenantMaxAggregateOutputType = {
    id: string | null
    name: string | null
    domain: string | null
    schemaName: string | null
    subscriptionPlan: string | null
    createdAt: Date | null
    updatedAt: Date | null
    isActive: boolean | null
    adminEmail: string | null
    billingEmail: string | null
    dataRegion: string | null
  }

  export type TenantCountAggregateOutputType = {
    id: number
    name: number
    domain: number
    schemaName: number
    subscriptionPlan: number
    createdAt: number
    updatedAt: number
    isActive: number
    metadata: number
    adminEmail: number
    billingEmail: number
    dataRegion: number
    complianceSettings: number
    _all: number
  }


  export type TenantMinAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    schemaName?: true
    subscriptionPlan?: true
    createdAt?: true
    updatedAt?: true
    isActive?: true
    adminEmail?: true
    billingEmail?: true
    dataRegion?: true
  }

  export type TenantMaxAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    schemaName?: true
    subscriptionPlan?: true
    createdAt?: true
    updatedAt?: true
    isActive?: true
    adminEmail?: true
    billingEmail?: true
    dataRegion?: true
  }

  export type TenantCountAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    schemaName?: true
    subscriptionPlan?: true
    createdAt?: true
    updatedAt?: true
    isActive?: true
    metadata?: true
    adminEmail?: true
    billingEmail?: true
    dataRegion?: true
    complianceSettings?: true
    _all?: true
  }

  export type TenantAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Tenant to aggregate.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Tenants
    **/
    _count?: true | TenantCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantMaxAggregateInputType
  }

  export type GetTenantAggregateType<T extends TenantAggregateArgs> = {
        [P in keyof T & keyof AggregateTenant]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenant[P]>
      : GetScalarType<T[P], AggregateTenant[P]>
  }




  export type TenantGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantWhereInput
    orderBy?: TenantOrderByWithAggregationInput | TenantOrderByWithAggregationInput[]
    by: TenantScalarFieldEnum[] | TenantScalarFieldEnum
    having?: TenantScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantCountAggregateInputType | true
    _min?: TenantMinAggregateInputType
    _max?: TenantMaxAggregateInputType
  }

  export type TenantGroupByOutputType = {
    id: string
    name: string
    domain: string
    schemaName: string
    subscriptionPlan: string
    createdAt: Date
    updatedAt: Date
    isActive: boolean
    metadata: JsonValue
    adminEmail: string | null
    billingEmail: string | null
    dataRegion: string
    complianceSettings: JsonValue
    _count: TenantCountAggregateOutputType | null
    _min: TenantMinAggregateOutputType | null
    _max: TenantMaxAggregateOutputType | null
  }

  type GetTenantGroupByPayload<T extends TenantGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantGroupByOutputType[P]>
            : GetScalarType<T[P], TenantGroupByOutputType[P]>
        }
      >
    >


  export type TenantSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    domain?: boolean
    schemaName?: boolean
    subscriptionPlan?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isActive?: boolean
    metadata?: boolean
    adminEmail?: boolean
    billingEmail?: boolean
    dataRegion?: boolean
    complianceSettings?: boolean
  }, ExtArgs["result"]["tenant"]>

  export type TenantSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    domain?: boolean
    schemaName?: boolean
    subscriptionPlan?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isActive?: boolean
    metadata?: boolean
    adminEmail?: boolean
    billingEmail?: boolean
    dataRegion?: boolean
    complianceSettings?: boolean
  }, ExtArgs["result"]["tenant"]>

  export type TenantSelectScalar = {
    id?: boolean
    name?: boolean
    domain?: boolean
    schemaName?: boolean
    subscriptionPlan?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isActive?: boolean
    metadata?: boolean
    adminEmail?: boolean
    billingEmail?: boolean
    dataRegion?: boolean
    complianceSettings?: boolean
  }


  export type $TenantPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Tenant"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      domain: string
      schemaName: string
      subscriptionPlan: string
      createdAt: Date
      updatedAt: Date
      isActive: boolean
      metadata: Prisma.JsonValue
      adminEmail: string | null
      billingEmail: string | null
      dataRegion: string
      complianceSettings: Prisma.JsonValue
    }, ExtArgs["result"]["tenant"]>
    composites: {}
  }

  type TenantGetPayload<S extends boolean | null | undefined | TenantDefaultArgs> = $Result.GetResult<Prisma.$TenantPayload, S>

  type TenantCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<TenantFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: TenantCountAggregateInputType | true
    }

  export interface TenantDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Tenant'], meta: { name: 'Tenant' } }
    /**
     * Find zero or one Tenant that matches the filter.
     * @param {TenantFindUniqueArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantFindUniqueArgs>(args: SelectSubset<T, TenantFindUniqueArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Tenant that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {TenantFindUniqueOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Tenant that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantFindFirstArgs>(args?: SelectSubset<T, TenantFindFirstArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Tenant that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Tenants that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tenants
     * const tenants = await prisma.tenant.findMany()
     * 
     * // Get first 10 Tenants
     * const tenants = await prisma.tenant.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantWithIdOnly = await prisma.tenant.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantFindManyArgs>(args?: SelectSubset<T, TenantFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Tenant.
     * @param {TenantCreateArgs} args - Arguments to create a Tenant.
     * @example
     * // Create one Tenant
     * const Tenant = await prisma.tenant.create({
     *   data: {
     *     // ... data to create a Tenant
     *   }
     * })
     * 
     */
    create<T extends TenantCreateArgs>(args: SelectSubset<T, TenantCreateArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Tenants.
     * @param {TenantCreateManyArgs} args - Arguments to create many Tenants.
     * @example
     * // Create many Tenants
     * const tenant = await prisma.tenant.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantCreateManyArgs>(args?: SelectSubset<T, TenantCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Tenants and returns the data saved in the database.
     * @param {TenantCreateManyAndReturnArgs} args - Arguments to create many Tenants.
     * @example
     * // Create many Tenants
     * const tenant = await prisma.tenant.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Tenants and only return the `id`
     * const tenantWithIdOnly = await prisma.tenant.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TenantCreateManyAndReturnArgs>(args?: SelectSubset<T, TenantCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Tenant.
     * @param {TenantDeleteArgs} args - Arguments to delete one Tenant.
     * @example
     * // Delete one Tenant
     * const Tenant = await prisma.tenant.delete({
     *   where: {
     *     // ... filter to delete one Tenant
     *   }
     * })
     * 
     */
    delete<T extends TenantDeleteArgs>(args: SelectSubset<T, TenantDeleteArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Tenant.
     * @param {TenantUpdateArgs} args - Arguments to update one Tenant.
     * @example
     * // Update one Tenant
     * const tenant = await prisma.tenant.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantUpdateArgs>(args: SelectSubset<T, TenantUpdateArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Tenants.
     * @param {TenantDeleteManyArgs} args - Arguments to filter Tenants to delete.
     * @example
     * // Delete a few Tenants
     * const { count } = await prisma.tenant.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantDeleteManyArgs>(args?: SelectSubset<T, TenantDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tenants
     * const tenant = await prisma.tenant.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantUpdateManyArgs>(args: SelectSubset<T, TenantUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Tenant.
     * @param {TenantUpsertArgs} args - Arguments to update or create a Tenant.
     * @example
     * // Update or create a Tenant
     * const tenant = await prisma.tenant.upsert({
     *   create: {
     *     // ... data to create a Tenant
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Tenant we want to update
     *   }
     * })
     */
    upsert<T extends TenantUpsertArgs>(args: SelectSubset<T, TenantUpsertArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantCountArgs} args - Arguments to filter Tenants to count.
     * @example
     * // Count the number of Tenants
     * const count = await prisma.tenant.count({
     *   where: {
     *     // ... the filter for the Tenants we want to count
     *   }
     * })
    **/
    count<T extends TenantCountArgs>(
      args?: Subset<T, TenantCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantAggregateArgs>(args: Subset<T, TenantAggregateArgs>): Prisma.PrismaPromise<GetTenantAggregateType<T>>

    /**
     * Group by Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantGroupByArgs['orderBy'] }
        : { orderBy?: TenantGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Tenant model
   */
  readonly fields: TenantFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Tenant.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Tenant model
   */ 
  interface TenantFieldRefs {
    readonly id: FieldRef<"Tenant", 'String'>
    readonly name: FieldRef<"Tenant", 'String'>
    readonly domain: FieldRef<"Tenant", 'String'>
    readonly schemaName: FieldRef<"Tenant", 'String'>
    readonly subscriptionPlan: FieldRef<"Tenant", 'String'>
    readonly createdAt: FieldRef<"Tenant", 'DateTime'>
    readonly updatedAt: FieldRef<"Tenant", 'DateTime'>
    readonly isActive: FieldRef<"Tenant", 'Boolean'>
    readonly metadata: FieldRef<"Tenant", 'Json'>
    readonly adminEmail: FieldRef<"Tenant", 'String'>
    readonly billingEmail: FieldRef<"Tenant", 'String'>
    readonly dataRegion: FieldRef<"Tenant", 'String'>
    readonly complianceSettings: FieldRef<"Tenant", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * Tenant findUnique
   */
  export type TenantFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant findUniqueOrThrow
   */
  export type TenantFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant findFirst
   */
  export type TenantFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant findFirstOrThrow
   */
  export type TenantFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant findMany
   */
  export type TenantFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter, which Tenants to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant create
   */
  export type TenantCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * The data needed to create a Tenant.
     */
    data: XOR<TenantCreateInput, TenantUncheckedCreateInput>
  }

  /**
   * Tenant createMany
   */
  export type TenantCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Tenants.
     */
    data: TenantCreateManyInput | TenantCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Tenant createManyAndReturn
   */
  export type TenantCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Tenants.
     */
    data: TenantCreateManyInput | TenantCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Tenant update
   */
  export type TenantUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * The data needed to update a Tenant.
     */
    data: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>
    /**
     * Choose, which Tenant to update.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant updateMany
   */
  export type TenantUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Tenants.
     */
    data: XOR<TenantUpdateManyMutationInput, TenantUncheckedUpdateManyInput>
    /**
     * Filter which Tenants to update
     */
    where?: TenantWhereInput
  }

  /**
   * Tenant upsert
   */
  export type TenantUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * The filter to search for the Tenant to update in case it exists.
     */
    where: TenantWhereUniqueInput
    /**
     * In case the Tenant found by the `where` argument doesn't exist, create a new Tenant with this data.
     */
    create: XOR<TenantCreateInput, TenantUncheckedCreateInput>
    /**
     * In case the Tenant was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>
  }

  /**
   * Tenant delete
   */
  export type TenantDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Filter which Tenant to delete.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant deleteMany
   */
  export type TenantDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Tenants to delete
     */
    where?: TenantWhereInput
  }

  /**
   * Tenant without action
   */
  export type TenantDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    loginCount: number | null
  }

  export type UserSumAggregateOutputType = {
    loginCount: number | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    firstName: string | null
    lastName: string | null
    role: string | null
    password: string | null
    ssoProvider: string | null
    ssoUserId: string | null
    lastLogin: Date | null
    loginCount: number | null
    timezone: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    firstName: string | null
    lastName: string | null
    role: string | null
    password: string | null
    ssoProvider: string | null
    ssoUserId: string | null
    lastLogin: Date | null
    loginCount: number | null
    timezone: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    firstName: number
    lastName: number
    role: number
    password: number
    ssoProvider: number
    ssoUserId: number
    lastLogin: number
    loginCount: number
    timezone: number
    preferences: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    loginCount?: true
  }

  export type UserSumAggregateInputType = {
    loginCount?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    firstName?: true
    lastName?: true
    role?: true
    password?: true
    ssoProvider?: true
    ssoUserId?: true
    lastLogin?: true
    loginCount?: true
    timezone?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    firstName?: true
    lastName?: true
    role?: true
    password?: true
    ssoProvider?: true
    ssoUserId?: true
    lastLogin?: true
    loginCount?: true
    timezone?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    firstName?: true
    lastName?: true
    role?: true
    password?: true
    ssoProvider?: true
    ssoUserId?: true
    lastLogin?: true
    loginCount?: true
    timezone?: true
    preferences?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    password: string | null
    ssoProvider: string | null
    ssoUserId: string | null
    lastLogin: Date | null
    loginCount: number
    timezone: string
    preferences: JsonValue
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    firstName?: boolean
    lastName?: boolean
    role?: boolean
    password?: boolean
    ssoProvider?: boolean
    ssoUserId?: boolean
    lastLogin?: boolean
    loginCount?: boolean
    timezone?: boolean
    preferences?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    metricsSessions?: boolean | User$metricsSessionsArgs<ExtArgs>
    dashboardConfigs?: boolean | User$dashboardConfigsArgs<ExtArgs>
    activities?: boolean | User$activitiesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    firstName?: boolean
    lastName?: boolean
    role?: boolean
    password?: boolean
    ssoProvider?: boolean
    ssoUserId?: boolean
    lastLogin?: boolean
    loginCount?: boolean
    timezone?: boolean
    preferences?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    firstName?: boolean
    lastName?: boolean
    role?: boolean
    password?: boolean
    ssoProvider?: boolean
    ssoUserId?: boolean
    lastLogin?: boolean
    loginCount?: boolean
    timezone?: boolean
    preferences?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    metricsSessions?: boolean | User$metricsSessionsArgs<ExtArgs>
    dashboardConfigs?: boolean | User$dashboardConfigsArgs<ExtArgs>
    activities?: boolean | User$activitiesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      metricsSessions: Prisma.$MetricsSessionPayload<ExtArgs>[]
      dashboardConfigs: Prisma.$DashboardConfigPayload<ExtArgs>[]
      activities: Prisma.$ActivityDataPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      password: string | null
      ssoProvider: string | null
      ssoUserId: string | null
      lastLogin: Date | null
      loginCount: number
      timezone: string
      preferences: Prisma.JsonValue
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    metricsSessions<T extends User$metricsSessionsArgs<ExtArgs> = {}>(args?: Subset<T, User$metricsSessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findMany"> | Null>
    dashboardConfigs<T extends User$dashboardConfigsArgs<ExtArgs> = {}>(args?: Subset<T, User$dashboardConfigsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findMany"> | Null>
    activities<T extends User$activitiesArgs<ExtArgs> = {}>(args?: Subset<T, User$activitiesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */ 
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly firstName: FieldRef<"User", 'String'>
    readonly lastName: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly ssoProvider: FieldRef<"User", 'String'>
    readonly ssoUserId: FieldRef<"User", 'String'>
    readonly lastLogin: FieldRef<"User", 'DateTime'>
    readonly loginCount: FieldRef<"User", 'Int'>
    readonly timezone: FieldRef<"User", 'String'>
    readonly preferences: FieldRef<"User", 'Json'>
    readonly isActive: FieldRef<"User", 'Boolean'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
  }

  /**
   * User.metricsSessions
   */
  export type User$metricsSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    where?: MetricsSessionWhereInput
    orderBy?: MetricsSessionOrderByWithRelationInput | MetricsSessionOrderByWithRelationInput[]
    cursor?: MetricsSessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MetricsSessionScalarFieldEnum | MetricsSessionScalarFieldEnum[]
  }

  /**
   * User.dashboardConfigs
   */
  export type User$dashboardConfigsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    where?: DashboardConfigWhereInput
    orderBy?: DashboardConfigOrderByWithRelationInput | DashboardConfigOrderByWithRelationInput[]
    cursor?: DashboardConfigWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DashboardConfigScalarFieldEnum | DashboardConfigScalarFieldEnum[]
  }

  /**
   * User.activities
   */
  export type User$activitiesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    where?: ActivityDataWhereInput
    orderBy?: ActivityDataOrderByWithRelationInput | ActivityDataOrderByWithRelationInput[]
    cursor?: ActivityDataWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ActivityDataScalarFieldEnum | ActivityDataScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model MetricsSession
   */

  export type AggregateMetricsSession = {
    _count: MetricsSessionCountAggregateOutputType | null
    _avg: MetricsSessionAvgAggregateOutputType | null
    _sum: MetricsSessionSumAggregateOutputType | null
    _min: MetricsSessionMinAggregateOutputType | null
    _max: MetricsSessionMaxAggregateOutputType | null
  }

  export type MetricsSessionAvgAggregateOutputType = {
    totalDurationMs: number | null
    productivityScore: number | null
    interruptionsCount: number | null
    focusTimeMs: number | null
  }

  export type MetricsSessionSumAggregateOutputType = {
    totalDurationMs: bigint | null
    productivityScore: number | null
    interruptionsCount: number | null
    focusTimeMs: bigint | null
  }

  export type MetricsSessionMinAggregateOutputType = {
    id: string | null
    userId: string | null
    sessionStart: Date | null
    sessionEnd: Date | null
    totalDurationMs: bigint | null
    productivityScore: number | null
    sessionType: string | null
    projectId: string | null
    interruptionsCount: number | null
    focusTimeMs: bigint | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MetricsSessionMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    sessionStart: Date | null
    sessionEnd: Date | null
    totalDurationMs: bigint | null
    productivityScore: number | null
    sessionType: string | null
    projectId: string | null
    interruptionsCount: number | null
    focusTimeMs: bigint | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MetricsSessionCountAggregateOutputType = {
    id: number
    userId: number
    sessionStart: number
    sessionEnd: number
    totalDurationMs: number
    toolsUsed: number
    productivityScore: number
    sessionType: number
    projectId: number
    tags: number
    interruptionsCount: number
    focusTimeMs: number
    description: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MetricsSessionAvgAggregateInputType = {
    totalDurationMs?: true
    productivityScore?: true
    interruptionsCount?: true
    focusTimeMs?: true
  }

  export type MetricsSessionSumAggregateInputType = {
    totalDurationMs?: true
    productivityScore?: true
    interruptionsCount?: true
    focusTimeMs?: true
  }

  export type MetricsSessionMinAggregateInputType = {
    id?: true
    userId?: true
    sessionStart?: true
    sessionEnd?: true
    totalDurationMs?: true
    productivityScore?: true
    sessionType?: true
    projectId?: true
    interruptionsCount?: true
    focusTimeMs?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MetricsSessionMaxAggregateInputType = {
    id?: true
    userId?: true
    sessionStart?: true
    sessionEnd?: true
    totalDurationMs?: true
    productivityScore?: true
    sessionType?: true
    projectId?: true
    interruptionsCount?: true
    focusTimeMs?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MetricsSessionCountAggregateInputType = {
    id?: true
    userId?: true
    sessionStart?: true
    sessionEnd?: true
    totalDurationMs?: true
    toolsUsed?: true
    productivityScore?: true
    sessionType?: true
    projectId?: true
    tags?: true
    interruptionsCount?: true
    focusTimeMs?: true
    description?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MetricsSessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MetricsSession to aggregate.
     */
    where?: MetricsSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MetricsSessions to fetch.
     */
    orderBy?: MetricsSessionOrderByWithRelationInput | MetricsSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MetricsSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MetricsSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MetricsSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MetricsSessions
    **/
    _count?: true | MetricsSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MetricsSessionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MetricsSessionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MetricsSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MetricsSessionMaxAggregateInputType
  }

  export type GetMetricsSessionAggregateType<T extends MetricsSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateMetricsSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMetricsSession[P]>
      : GetScalarType<T[P], AggregateMetricsSession[P]>
  }




  export type MetricsSessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MetricsSessionWhereInput
    orderBy?: MetricsSessionOrderByWithAggregationInput | MetricsSessionOrderByWithAggregationInput[]
    by: MetricsSessionScalarFieldEnum[] | MetricsSessionScalarFieldEnum
    having?: MetricsSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MetricsSessionCountAggregateInputType | true
    _avg?: MetricsSessionAvgAggregateInputType
    _sum?: MetricsSessionSumAggregateInputType
    _min?: MetricsSessionMinAggregateInputType
    _max?: MetricsSessionMaxAggregateInputType
  }

  export type MetricsSessionGroupByOutputType = {
    id: string
    userId: string
    sessionStart: Date
    sessionEnd: Date | null
    totalDurationMs: bigint | null
    toolsUsed: JsonValue | null
    productivityScore: number | null
    sessionType: string
    projectId: string | null
    tags: JsonValue
    interruptionsCount: number
    focusTimeMs: bigint
    description: string | null
    createdAt: Date
    updatedAt: Date
    _count: MetricsSessionCountAggregateOutputType | null
    _avg: MetricsSessionAvgAggregateOutputType | null
    _sum: MetricsSessionSumAggregateOutputType | null
    _min: MetricsSessionMinAggregateOutputType | null
    _max: MetricsSessionMaxAggregateOutputType | null
  }

  type GetMetricsSessionGroupByPayload<T extends MetricsSessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MetricsSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MetricsSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MetricsSessionGroupByOutputType[P]>
            : GetScalarType<T[P], MetricsSessionGroupByOutputType[P]>
        }
      >
    >


  export type MetricsSessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sessionStart?: boolean
    sessionEnd?: boolean
    totalDurationMs?: boolean
    toolsUsed?: boolean
    productivityScore?: boolean
    sessionType?: boolean
    projectId?: boolean
    tags?: boolean
    interruptionsCount?: boolean
    focusTimeMs?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    toolMetrics?: boolean | MetricsSession$toolMetricsArgs<ExtArgs>
    _count?: boolean | MetricsSessionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["metricsSession"]>

  export type MetricsSessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sessionStart?: boolean
    sessionEnd?: boolean
    totalDurationMs?: boolean
    toolsUsed?: boolean
    productivityScore?: boolean
    sessionType?: boolean
    projectId?: boolean
    tags?: boolean
    interruptionsCount?: boolean
    focusTimeMs?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["metricsSession"]>

  export type MetricsSessionSelectScalar = {
    id?: boolean
    userId?: boolean
    sessionStart?: boolean
    sessionEnd?: boolean
    totalDurationMs?: boolean
    toolsUsed?: boolean
    productivityScore?: boolean
    sessionType?: boolean
    projectId?: boolean
    tags?: boolean
    interruptionsCount?: boolean
    focusTimeMs?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MetricsSessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    toolMetrics?: boolean | MetricsSession$toolMetricsArgs<ExtArgs>
    _count?: boolean | MetricsSessionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type MetricsSessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $MetricsSessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MetricsSession"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      toolMetrics: Prisma.$ToolMetricPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      sessionStart: Date
      sessionEnd: Date | null
      totalDurationMs: bigint | null
      toolsUsed: Prisma.JsonValue | null
      productivityScore: number | null
      sessionType: string
      projectId: string | null
      tags: Prisma.JsonValue
      interruptionsCount: number
      focusTimeMs: bigint
      description: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["metricsSession"]>
    composites: {}
  }

  type MetricsSessionGetPayload<S extends boolean | null | undefined | MetricsSessionDefaultArgs> = $Result.GetResult<Prisma.$MetricsSessionPayload, S>

  type MetricsSessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MetricsSessionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MetricsSessionCountAggregateInputType | true
    }

  export interface MetricsSessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MetricsSession'], meta: { name: 'MetricsSession' } }
    /**
     * Find zero or one MetricsSession that matches the filter.
     * @param {MetricsSessionFindUniqueArgs} args - Arguments to find a MetricsSession
     * @example
     * // Get one MetricsSession
     * const metricsSession = await prisma.metricsSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MetricsSessionFindUniqueArgs>(args: SelectSubset<T, MetricsSessionFindUniqueArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MetricsSession that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MetricsSessionFindUniqueOrThrowArgs} args - Arguments to find a MetricsSession
     * @example
     * // Get one MetricsSession
     * const metricsSession = await prisma.metricsSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MetricsSessionFindUniqueOrThrowArgs>(args: SelectSubset<T, MetricsSessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MetricsSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionFindFirstArgs} args - Arguments to find a MetricsSession
     * @example
     * // Get one MetricsSession
     * const metricsSession = await prisma.metricsSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MetricsSessionFindFirstArgs>(args?: SelectSubset<T, MetricsSessionFindFirstArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MetricsSession that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionFindFirstOrThrowArgs} args - Arguments to find a MetricsSession
     * @example
     * // Get one MetricsSession
     * const metricsSession = await prisma.metricsSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MetricsSessionFindFirstOrThrowArgs>(args?: SelectSubset<T, MetricsSessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MetricsSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MetricsSessions
     * const metricsSessions = await prisma.metricsSession.findMany()
     * 
     * // Get first 10 MetricsSessions
     * const metricsSessions = await prisma.metricsSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const metricsSessionWithIdOnly = await prisma.metricsSession.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MetricsSessionFindManyArgs>(args?: SelectSubset<T, MetricsSessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MetricsSession.
     * @param {MetricsSessionCreateArgs} args - Arguments to create a MetricsSession.
     * @example
     * // Create one MetricsSession
     * const MetricsSession = await prisma.metricsSession.create({
     *   data: {
     *     // ... data to create a MetricsSession
     *   }
     * })
     * 
     */
    create<T extends MetricsSessionCreateArgs>(args: SelectSubset<T, MetricsSessionCreateArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MetricsSessions.
     * @param {MetricsSessionCreateManyArgs} args - Arguments to create many MetricsSessions.
     * @example
     * // Create many MetricsSessions
     * const metricsSession = await prisma.metricsSession.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MetricsSessionCreateManyArgs>(args?: SelectSubset<T, MetricsSessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MetricsSessions and returns the data saved in the database.
     * @param {MetricsSessionCreateManyAndReturnArgs} args - Arguments to create many MetricsSessions.
     * @example
     * // Create many MetricsSessions
     * const metricsSession = await prisma.metricsSession.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MetricsSessions and only return the `id`
     * const metricsSessionWithIdOnly = await prisma.metricsSession.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MetricsSessionCreateManyAndReturnArgs>(args?: SelectSubset<T, MetricsSessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MetricsSession.
     * @param {MetricsSessionDeleteArgs} args - Arguments to delete one MetricsSession.
     * @example
     * // Delete one MetricsSession
     * const MetricsSession = await prisma.metricsSession.delete({
     *   where: {
     *     // ... filter to delete one MetricsSession
     *   }
     * })
     * 
     */
    delete<T extends MetricsSessionDeleteArgs>(args: SelectSubset<T, MetricsSessionDeleteArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MetricsSession.
     * @param {MetricsSessionUpdateArgs} args - Arguments to update one MetricsSession.
     * @example
     * // Update one MetricsSession
     * const metricsSession = await prisma.metricsSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MetricsSessionUpdateArgs>(args: SelectSubset<T, MetricsSessionUpdateArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MetricsSessions.
     * @param {MetricsSessionDeleteManyArgs} args - Arguments to filter MetricsSessions to delete.
     * @example
     * // Delete a few MetricsSessions
     * const { count } = await prisma.metricsSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MetricsSessionDeleteManyArgs>(args?: SelectSubset<T, MetricsSessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MetricsSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MetricsSessions
     * const metricsSession = await prisma.metricsSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MetricsSessionUpdateManyArgs>(args: SelectSubset<T, MetricsSessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MetricsSession.
     * @param {MetricsSessionUpsertArgs} args - Arguments to update or create a MetricsSession.
     * @example
     * // Update or create a MetricsSession
     * const metricsSession = await prisma.metricsSession.upsert({
     *   create: {
     *     // ... data to create a MetricsSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MetricsSession we want to update
     *   }
     * })
     */
    upsert<T extends MetricsSessionUpsertArgs>(args: SelectSubset<T, MetricsSessionUpsertArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MetricsSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionCountArgs} args - Arguments to filter MetricsSessions to count.
     * @example
     * // Count the number of MetricsSessions
     * const count = await prisma.metricsSession.count({
     *   where: {
     *     // ... the filter for the MetricsSessions we want to count
     *   }
     * })
    **/
    count<T extends MetricsSessionCountArgs>(
      args?: Subset<T, MetricsSessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MetricsSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MetricsSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MetricsSessionAggregateArgs>(args: Subset<T, MetricsSessionAggregateArgs>): Prisma.PrismaPromise<GetMetricsSessionAggregateType<T>>

    /**
     * Group by MetricsSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MetricsSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MetricsSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MetricsSessionGroupByArgs['orderBy'] }
        : { orderBy?: MetricsSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MetricsSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMetricsSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MetricsSession model
   */
  readonly fields: MetricsSessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MetricsSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MetricsSessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    toolMetrics<T extends MetricsSession$toolMetricsArgs<ExtArgs> = {}>(args?: Subset<T, MetricsSession$toolMetricsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MetricsSession model
   */ 
  interface MetricsSessionFieldRefs {
    readonly id: FieldRef<"MetricsSession", 'String'>
    readonly userId: FieldRef<"MetricsSession", 'String'>
    readonly sessionStart: FieldRef<"MetricsSession", 'DateTime'>
    readonly sessionEnd: FieldRef<"MetricsSession", 'DateTime'>
    readonly totalDurationMs: FieldRef<"MetricsSession", 'BigInt'>
    readonly toolsUsed: FieldRef<"MetricsSession", 'Json'>
    readonly productivityScore: FieldRef<"MetricsSession", 'Int'>
    readonly sessionType: FieldRef<"MetricsSession", 'String'>
    readonly projectId: FieldRef<"MetricsSession", 'String'>
    readonly tags: FieldRef<"MetricsSession", 'Json'>
    readonly interruptionsCount: FieldRef<"MetricsSession", 'Int'>
    readonly focusTimeMs: FieldRef<"MetricsSession", 'BigInt'>
    readonly description: FieldRef<"MetricsSession", 'String'>
    readonly createdAt: FieldRef<"MetricsSession", 'DateTime'>
    readonly updatedAt: FieldRef<"MetricsSession", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MetricsSession findUnique
   */
  export type MetricsSessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter, which MetricsSession to fetch.
     */
    where: MetricsSessionWhereUniqueInput
  }

  /**
   * MetricsSession findUniqueOrThrow
   */
  export type MetricsSessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter, which MetricsSession to fetch.
     */
    where: MetricsSessionWhereUniqueInput
  }

  /**
   * MetricsSession findFirst
   */
  export type MetricsSessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter, which MetricsSession to fetch.
     */
    where?: MetricsSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MetricsSessions to fetch.
     */
    orderBy?: MetricsSessionOrderByWithRelationInput | MetricsSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MetricsSessions.
     */
    cursor?: MetricsSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MetricsSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MetricsSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MetricsSessions.
     */
    distinct?: MetricsSessionScalarFieldEnum | MetricsSessionScalarFieldEnum[]
  }

  /**
   * MetricsSession findFirstOrThrow
   */
  export type MetricsSessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter, which MetricsSession to fetch.
     */
    where?: MetricsSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MetricsSessions to fetch.
     */
    orderBy?: MetricsSessionOrderByWithRelationInput | MetricsSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MetricsSessions.
     */
    cursor?: MetricsSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MetricsSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MetricsSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MetricsSessions.
     */
    distinct?: MetricsSessionScalarFieldEnum | MetricsSessionScalarFieldEnum[]
  }

  /**
   * MetricsSession findMany
   */
  export type MetricsSessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter, which MetricsSessions to fetch.
     */
    where?: MetricsSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MetricsSessions to fetch.
     */
    orderBy?: MetricsSessionOrderByWithRelationInput | MetricsSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MetricsSessions.
     */
    cursor?: MetricsSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MetricsSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MetricsSessions.
     */
    skip?: number
    distinct?: MetricsSessionScalarFieldEnum | MetricsSessionScalarFieldEnum[]
  }

  /**
   * MetricsSession create
   */
  export type MetricsSessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * The data needed to create a MetricsSession.
     */
    data: XOR<MetricsSessionCreateInput, MetricsSessionUncheckedCreateInput>
  }

  /**
   * MetricsSession createMany
   */
  export type MetricsSessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MetricsSessions.
     */
    data: MetricsSessionCreateManyInput | MetricsSessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MetricsSession createManyAndReturn
   */
  export type MetricsSessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MetricsSessions.
     */
    data: MetricsSessionCreateManyInput | MetricsSessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * MetricsSession update
   */
  export type MetricsSessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * The data needed to update a MetricsSession.
     */
    data: XOR<MetricsSessionUpdateInput, MetricsSessionUncheckedUpdateInput>
    /**
     * Choose, which MetricsSession to update.
     */
    where: MetricsSessionWhereUniqueInput
  }

  /**
   * MetricsSession updateMany
   */
  export type MetricsSessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MetricsSessions.
     */
    data: XOR<MetricsSessionUpdateManyMutationInput, MetricsSessionUncheckedUpdateManyInput>
    /**
     * Filter which MetricsSessions to update
     */
    where?: MetricsSessionWhereInput
  }

  /**
   * MetricsSession upsert
   */
  export type MetricsSessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * The filter to search for the MetricsSession to update in case it exists.
     */
    where: MetricsSessionWhereUniqueInput
    /**
     * In case the MetricsSession found by the `where` argument doesn't exist, create a new MetricsSession with this data.
     */
    create: XOR<MetricsSessionCreateInput, MetricsSessionUncheckedCreateInput>
    /**
     * In case the MetricsSession was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MetricsSessionUpdateInput, MetricsSessionUncheckedUpdateInput>
  }

  /**
   * MetricsSession delete
   */
  export type MetricsSessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
    /**
     * Filter which MetricsSession to delete.
     */
    where: MetricsSessionWhereUniqueInput
  }

  /**
   * MetricsSession deleteMany
   */
  export type MetricsSessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MetricsSessions to delete
     */
    where?: MetricsSessionWhereInput
  }

  /**
   * MetricsSession.toolMetrics
   */
  export type MetricsSession$toolMetricsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    where?: ToolMetricWhereInput
    orderBy?: ToolMetricOrderByWithRelationInput | ToolMetricOrderByWithRelationInput[]
    cursor?: ToolMetricWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ToolMetricScalarFieldEnum | ToolMetricScalarFieldEnum[]
  }

  /**
   * MetricsSession without action
   */
  export type MetricsSessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MetricsSession
     */
    select?: MetricsSessionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MetricsSessionInclude<ExtArgs> | null
  }


  /**
   * Model ToolMetric
   */

  export type AggregateToolMetric = {
    _count: ToolMetricCountAggregateOutputType | null
    _avg: ToolMetricAvgAggregateOutputType | null
    _sum: ToolMetricSumAggregateOutputType | null
    _min: ToolMetricMinAggregateOutputType | null
    _max: ToolMetricMaxAggregateOutputType | null
  }

  export type ToolMetricAvgAggregateOutputType = {
    executionCount: number | null
    totalDurationMs: number | null
    averageDurationMs: number | null
    successRate: Decimal | null
    errorCount: number | null
    memoryUsageMb: number | null
    cpuTimeMs: number | null
    outputSizeBytes: number | null
  }

  export type ToolMetricSumAggregateOutputType = {
    executionCount: number | null
    totalDurationMs: bigint | null
    averageDurationMs: bigint | null
    successRate: Decimal | null
    errorCount: number | null
    memoryUsageMb: number | null
    cpuTimeMs: bigint | null
    outputSizeBytes: bigint | null
  }

  export type ToolMetricMinAggregateOutputType = {
    id: string | null
    sessionId: string | null
    toolName: string | null
    toolCategory: string | null
    executionCount: number | null
    totalDurationMs: bigint | null
    averageDurationMs: bigint | null
    successRate: Decimal | null
    errorCount: number | null
    memoryUsageMb: number | null
    cpuTimeMs: bigint | null
    outputSizeBytes: bigint | null
    commandLine: string | null
    workingDirectory: string | null
    createdAt: Date | null
  }

  export type ToolMetricMaxAggregateOutputType = {
    id: string | null
    sessionId: string | null
    toolName: string | null
    toolCategory: string | null
    executionCount: number | null
    totalDurationMs: bigint | null
    averageDurationMs: bigint | null
    successRate: Decimal | null
    errorCount: number | null
    memoryUsageMb: number | null
    cpuTimeMs: bigint | null
    outputSizeBytes: bigint | null
    commandLine: string | null
    workingDirectory: string | null
    createdAt: Date | null
  }

  export type ToolMetricCountAggregateOutputType = {
    id: number
    sessionId: number
    toolName: number
    toolCategory: number
    executionCount: number
    totalDurationMs: number
    averageDurationMs: number
    successRate: number
    errorCount: number
    memoryUsageMb: number
    cpuTimeMs: number
    parameters: number
    outputSizeBytes: number
    commandLine: number
    workingDirectory: number
    createdAt: number
    _all: number
  }


  export type ToolMetricAvgAggregateInputType = {
    executionCount?: true
    totalDurationMs?: true
    averageDurationMs?: true
    successRate?: true
    errorCount?: true
    memoryUsageMb?: true
    cpuTimeMs?: true
    outputSizeBytes?: true
  }

  export type ToolMetricSumAggregateInputType = {
    executionCount?: true
    totalDurationMs?: true
    averageDurationMs?: true
    successRate?: true
    errorCount?: true
    memoryUsageMb?: true
    cpuTimeMs?: true
    outputSizeBytes?: true
  }

  export type ToolMetricMinAggregateInputType = {
    id?: true
    sessionId?: true
    toolName?: true
    toolCategory?: true
    executionCount?: true
    totalDurationMs?: true
    averageDurationMs?: true
    successRate?: true
    errorCount?: true
    memoryUsageMb?: true
    cpuTimeMs?: true
    outputSizeBytes?: true
    commandLine?: true
    workingDirectory?: true
    createdAt?: true
  }

  export type ToolMetricMaxAggregateInputType = {
    id?: true
    sessionId?: true
    toolName?: true
    toolCategory?: true
    executionCount?: true
    totalDurationMs?: true
    averageDurationMs?: true
    successRate?: true
    errorCount?: true
    memoryUsageMb?: true
    cpuTimeMs?: true
    outputSizeBytes?: true
    commandLine?: true
    workingDirectory?: true
    createdAt?: true
  }

  export type ToolMetricCountAggregateInputType = {
    id?: true
    sessionId?: true
    toolName?: true
    toolCategory?: true
    executionCount?: true
    totalDurationMs?: true
    averageDurationMs?: true
    successRate?: true
    errorCount?: true
    memoryUsageMb?: true
    cpuTimeMs?: true
    parameters?: true
    outputSizeBytes?: true
    commandLine?: true
    workingDirectory?: true
    createdAt?: true
    _all?: true
  }

  export type ToolMetricAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ToolMetric to aggregate.
     */
    where?: ToolMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ToolMetrics to fetch.
     */
    orderBy?: ToolMetricOrderByWithRelationInput | ToolMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ToolMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ToolMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ToolMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ToolMetrics
    **/
    _count?: true | ToolMetricCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ToolMetricAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ToolMetricSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ToolMetricMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ToolMetricMaxAggregateInputType
  }

  export type GetToolMetricAggregateType<T extends ToolMetricAggregateArgs> = {
        [P in keyof T & keyof AggregateToolMetric]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateToolMetric[P]>
      : GetScalarType<T[P], AggregateToolMetric[P]>
  }




  export type ToolMetricGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ToolMetricWhereInput
    orderBy?: ToolMetricOrderByWithAggregationInput | ToolMetricOrderByWithAggregationInput[]
    by: ToolMetricScalarFieldEnum[] | ToolMetricScalarFieldEnum
    having?: ToolMetricScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ToolMetricCountAggregateInputType | true
    _avg?: ToolMetricAvgAggregateInputType
    _sum?: ToolMetricSumAggregateInputType
    _min?: ToolMetricMinAggregateInputType
    _max?: ToolMetricMaxAggregateInputType
  }

  export type ToolMetricGroupByOutputType = {
    id: string
    sessionId: string
    toolName: string
    toolCategory: string | null
    executionCount: number
    totalDurationMs: bigint
    averageDurationMs: bigint
    successRate: Decimal
    errorCount: number
    memoryUsageMb: number | null
    cpuTimeMs: bigint | null
    parameters: JsonValue | null
    outputSizeBytes: bigint | null
    commandLine: string | null
    workingDirectory: string | null
    createdAt: Date
    _count: ToolMetricCountAggregateOutputType | null
    _avg: ToolMetricAvgAggregateOutputType | null
    _sum: ToolMetricSumAggregateOutputType | null
    _min: ToolMetricMinAggregateOutputType | null
    _max: ToolMetricMaxAggregateOutputType | null
  }

  type GetToolMetricGroupByPayload<T extends ToolMetricGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ToolMetricGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ToolMetricGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ToolMetricGroupByOutputType[P]>
            : GetScalarType<T[P], ToolMetricGroupByOutputType[P]>
        }
      >
    >


  export type ToolMetricSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    toolName?: boolean
    toolCategory?: boolean
    executionCount?: boolean
    totalDurationMs?: boolean
    averageDurationMs?: boolean
    successRate?: boolean
    errorCount?: boolean
    memoryUsageMb?: boolean
    cpuTimeMs?: boolean
    parameters?: boolean
    outputSizeBytes?: boolean
    commandLine?: boolean
    workingDirectory?: boolean
    createdAt?: boolean
    session?: boolean | MetricsSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["toolMetric"]>

  export type ToolMetricSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    toolName?: boolean
    toolCategory?: boolean
    executionCount?: boolean
    totalDurationMs?: boolean
    averageDurationMs?: boolean
    successRate?: boolean
    errorCount?: boolean
    memoryUsageMb?: boolean
    cpuTimeMs?: boolean
    parameters?: boolean
    outputSizeBytes?: boolean
    commandLine?: boolean
    workingDirectory?: boolean
    createdAt?: boolean
    session?: boolean | MetricsSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["toolMetric"]>

  export type ToolMetricSelectScalar = {
    id?: boolean
    sessionId?: boolean
    toolName?: boolean
    toolCategory?: boolean
    executionCount?: boolean
    totalDurationMs?: boolean
    averageDurationMs?: boolean
    successRate?: boolean
    errorCount?: boolean
    memoryUsageMb?: boolean
    cpuTimeMs?: boolean
    parameters?: boolean
    outputSizeBytes?: boolean
    commandLine?: boolean
    workingDirectory?: boolean
    createdAt?: boolean
  }

  export type ToolMetricInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | MetricsSessionDefaultArgs<ExtArgs>
  }
  export type ToolMetricIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | MetricsSessionDefaultArgs<ExtArgs>
  }

  export type $ToolMetricPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ToolMetric"
    objects: {
      session: Prisma.$MetricsSessionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      sessionId: string
      toolName: string
      toolCategory: string | null
      executionCount: number
      totalDurationMs: bigint
      averageDurationMs: bigint
      successRate: Prisma.Decimal
      errorCount: number
      memoryUsageMb: number | null
      cpuTimeMs: bigint | null
      parameters: Prisma.JsonValue | null
      outputSizeBytes: bigint | null
      commandLine: string | null
      workingDirectory: string | null
      createdAt: Date
    }, ExtArgs["result"]["toolMetric"]>
    composites: {}
  }

  type ToolMetricGetPayload<S extends boolean | null | undefined | ToolMetricDefaultArgs> = $Result.GetResult<Prisma.$ToolMetricPayload, S>

  type ToolMetricCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ToolMetricFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ToolMetricCountAggregateInputType | true
    }

  export interface ToolMetricDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ToolMetric'], meta: { name: 'ToolMetric' } }
    /**
     * Find zero or one ToolMetric that matches the filter.
     * @param {ToolMetricFindUniqueArgs} args - Arguments to find a ToolMetric
     * @example
     * // Get one ToolMetric
     * const toolMetric = await prisma.toolMetric.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ToolMetricFindUniqueArgs>(args: SelectSubset<T, ToolMetricFindUniqueArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ToolMetric that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ToolMetricFindUniqueOrThrowArgs} args - Arguments to find a ToolMetric
     * @example
     * // Get one ToolMetric
     * const toolMetric = await prisma.toolMetric.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ToolMetricFindUniqueOrThrowArgs>(args: SelectSubset<T, ToolMetricFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ToolMetric that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricFindFirstArgs} args - Arguments to find a ToolMetric
     * @example
     * // Get one ToolMetric
     * const toolMetric = await prisma.toolMetric.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ToolMetricFindFirstArgs>(args?: SelectSubset<T, ToolMetricFindFirstArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ToolMetric that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricFindFirstOrThrowArgs} args - Arguments to find a ToolMetric
     * @example
     * // Get one ToolMetric
     * const toolMetric = await prisma.toolMetric.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ToolMetricFindFirstOrThrowArgs>(args?: SelectSubset<T, ToolMetricFindFirstOrThrowArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ToolMetrics that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ToolMetrics
     * const toolMetrics = await prisma.toolMetric.findMany()
     * 
     * // Get first 10 ToolMetrics
     * const toolMetrics = await prisma.toolMetric.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const toolMetricWithIdOnly = await prisma.toolMetric.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ToolMetricFindManyArgs>(args?: SelectSubset<T, ToolMetricFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ToolMetric.
     * @param {ToolMetricCreateArgs} args - Arguments to create a ToolMetric.
     * @example
     * // Create one ToolMetric
     * const ToolMetric = await prisma.toolMetric.create({
     *   data: {
     *     // ... data to create a ToolMetric
     *   }
     * })
     * 
     */
    create<T extends ToolMetricCreateArgs>(args: SelectSubset<T, ToolMetricCreateArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ToolMetrics.
     * @param {ToolMetricCreateManyArgs} args - Arguments to create many ToolMetrics.
     * @example
     * // Create many ToolMetrics
     * const toolMetric = await prisma.toolMetric.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ToolMetricCreateManyArgs>(args?: SelectSubset<T, ToolMetricCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ToolMetrics and returns the data saved in the database.
     * @param {ToolMetricCreateManyAndReturnArgs} args - Arguments to create many ToolMetrics.
     * @example
     * // Create many ToolMetrics
     * const toolMetric = await prisma.toolMetric.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ToolMetrics and only return the `id`
     * const toolMetricWithIdOnly = await prisma.toolMetric.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ToolMetricCreateManyAndReturnArgs>(args?: SelectSubset<T, ToolMetricCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ToolMetric.
     * @param {ToolMetricDeleteArgs} args - Arguments to delete one ToolMetric.
     * @example
     * // Delete one ToolMetric
     * const ToolMetric = await prisma.toolMetric.delete({
     *   where: {
     *     // ... filter to delete one ToolMetric
     *   }
     * })
     * 
     */
    delete<T extends ToolMetricDeleteArgs>(args: SelectSubset<T, ToolMetricDeleteArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ToolMetric.
     * @param {ToolMetricUpdateArgs} args - Arguments to update one ToolMetric.
     * @example
     * // Update one ToolMetric
     * const toolMetric = await prisma.toolMetric.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ToolMetricUpdateArgs>(args: SelectSubset<T, ToolMetricUpdateArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ToolMetrics.
     * @param {ToolMetricDeleteManyArgs} args - Arguments to filter ToolMetrics to delete.
     * @example
     * // Delete a few ToolMetrics
     * const { count } = await prisma.toolMetric.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ToolMetricDeleteManyArgs>(args?: SelectSubset<T, ToolMetricDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ToolMetrics.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ToolMetrics
     * const toolMetric = await prisma.toolMetric.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ToolMetricUpdateManyArgs>(args: SelectSubset<T, ToolMetricUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ToolMetric.
     * @param {ToolMetricUpsertArgs} args - Arguments to update or create a ToolMetric.
     * @example
     * // Update or create a ToolMetric
     * const toolMetric = await prisma.toolMetric.upsert({
     *   create: {
     *     // ... data to create a ToolMetric
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ToolMetric we want to update
     *   }
     * })
     */
    upsert<T extends ToolMetricUpsertArgs>(args: SelectSubset<T, ToolMetricUpsertArgs<ExtArgs>>): Prisma__ToolMetricClient<$Result.GetResult<Prisma.$ToolMetricPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ToolMetrics.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricCountArgs} args - Arguments to filter ToolMetrics to count.
     * @example
     * // Count the number of ToolMetrics
     * const count = await prisma.toolMetric.count({
     *   where: {
     *     // ... the filter for the ToolMetrics we want to count
     *   }
     * })
    **/
    count<T extends ToolMetricCountArgs>(
      args?: Subset<T, ToolMetricCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ToolMetricCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ToolMetric.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ToolMetricAggregateArgs>(args: Subset<T, ToolMetricAggregateArgs>): Prisma.PrismaPromise<GetToolMetricAggregateType<T>>

    /**
     * Group by ToolMetric.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ToolMetricGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ToolMetricGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ToolMetricGroupByArgs['orderBy'] }
        : { orderBy?: ToolMetricGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ToolMetricGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetToolMetricGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ToolMetric model
   */
  readonly fields: ToolMetricFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ToolMetric.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ToolMetricClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    session<T extends MetricsSessionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, MetricsSessionDefaultArgs<ExtArgs>>): Prisma__MetricsSessionClient<$Result.GetResult<Prisma.$MetricsSessionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ToolMetric model
   */ 
  interface ToolMetricFieldRefs {
    readonly id: FieldRef<"ToolMetric", 'String'>
    readonly sessionId: FieldRef<"ToolMetric", 'String'>
    readonly toolName: FieldRef<"ToolMetric", 'String'>
    readonly toolCategory: FieldRef<"ToolMetric", 'String'>
    readonly executionCount: FieldRef<"ToolMetric", 'Int'>
    readonly totalDurationMs: FieldRef<"ToolMetric", 'BigInt'>
    readonly averageDurationMs: FieldRef<"ToolMetric", 'BigInt'>
    readonly successRate: FieldRef<"ToolMetric", 'Decimal'>
    readonly errorCount: FieldRef<"ToolMetric", 'Int'>
    readonly memoryUsageMb: FieldRef<"ToolMetric", 'Int'>
    readonly cpuTimeMs: FieldRef<"ToolMetric", 'BigInt'>
    readonly parameters: FieldRef<"ToolMetric", 'Json'>
    readonly outputSizeBytes: FieldRef<"ToolMetric", 'BigInt'>
    readonly commandLine: FieldRef<"ToolMetric", 'String'>
    readonly workingDirectory: FieldRef<"ToolMetric", 'String'>
    readonly createdAt: FieldRef<"ToolMetric", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ToolMetric findUnique
   */
  export type ToolMetricFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter, which ToolMetric to fetch.
     */
    where: ToolMetricWhereUniqueInput
  }

  /**
   * ToolMetric findUniqueOrThrow
   */
  export type ToolMetricFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter, which ToolMetric to fetch.
     */
    where: ToolMetricWhereUniqueInput
  }

  /**
   * ToolMetric findFirst
   */
  export type ToolMetricFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter, which ToolMetric to fetch.
     */
    where?: ToolMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ToolMetrics to fetch.
     */
    orderBy?: ToolMetricOrderByWithRelationInput | ToolMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ToolMetrics.
     */
    cursor?: ToolMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ToolMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ToolMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ToolMetrics.
     */
    distinct?: ToolMetricScalarFieldEnum | ToolMetricScalarFieldEnum[]
  }

  /**
   * ToolMetric findFirstOrThrow
   */
  export type ToolMetricFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter, which ToolMetric to fetch.
     */
    where?: ToolMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ToolMetrics to fetch.
     */
    orderBy?: ToolMetricOrderByWithRelationInput | ToolMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ToolMetrics.
     */
    cursor?: ToolMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ToolMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ToolMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ToolMetrics.
     */
    distinct?: ToolMetricScalarFieldEnum | ToolMetricScalarFieldEnum[]
  }

  /**
   * ToolMetric findMany
   */
  export type ToolMetricFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter, which ToolMetrics to fetch.
     */
    where?: ToolMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ToolMetrics to fetch.
     */
    orderBy?: ToolMetricOrderByWithRelationInput | ToolMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ToolMetrics.
     */
    cursor?: ToolMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ToolMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ToolMetrics.
     */
    skip?: number
    distinct?: ToolMetricScalarFieldEnum | ToolMetricScalarFieldEnum[]
  }

  /**
   * ToolMetric create
   */
  export type ToolMetricCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * The data needed to create a ToolMetric.
     */
    data: XOR<ToolMetricCreateInput, ToolMetricUncheckedCreateInput>
  }

  /**
   * ToolMetric createMany
   */
  export type ToolMetricCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ToolMetrics.
     */
    data: ToolMetricCreateManyInput | ToolMetricCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ToolMetric createManyAndReturn
   */
  export type ToolMetricCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ToolMetrics.
     */
    data: ToolMetricCreateManyInput | ToolMetricCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ToolMetric update
   */
  export type ToolMetricUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * The data needed to update a ToolMetric.
     */
    data: XOR<ToolMetricUpdateInput, ToolMetricUncheckedUpdateInput>
    /**
     * Choose, which ToolMetric to update.
     */
    where: ToolMetricWhereUniqueInput
  }

  /**
   * ToolMetric updateMany
   */
  export type ToolMetricUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ToolMetrics.
     */
    data: XOR<ToolMetricUpdateManyMutationInput, ToolMetricUncheckedUpdateManyInput>
    /**
     * Filter which ToolMetrics to update
     */
    where?: ToolMetricWhereInput
  }

  /**
   * ToolMetric upsert
   */
  export type ToolMetricUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * The filter to search for the ToolMetric to update in case it exists.
     */
    where: ToolMetricWhereUniqueInput
    /**
     * In case the ToolMetric found by the `where` argument doesn't exist, create a new ToolMetric with this data.
     */
    create: XOR<ToolMetricCreateInput, ToolMetricUncheckedCreateInput>
    /**
     * In case the ToolMetric was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ToolMetricUpdateInput, ToolMetricUncheckedUpdateInput>
  }

  /**
   * ToolMetric delete
   */
  export type ToolMetricDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
    /**
     * Filter which ToolMetric to delete.
     */
    where: ToolMetricWhereUniqueInput
  }

  /**
   * ToolMetric deleteMany
   */
  export type ToolMetricDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ToolMetrics to delete
     */
    where?: ToolMetricWhereInput
  }

  /**
   * ToolMetric without action
   */
  export type ToolMetricDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ToolMetric
     */
    select?: ToolMetricSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ToolMetricInclude<ExtArgs> | null
  }


  /**
   * Model DashboardConfig
   */

  export type AggregateDashboardConfig = {
    _count: DashboardConfigCountAggregateOutputType | null
    _avg: DashboardConfigAvgAggregateOutputType | null
    _sum: DashboardConfigSumAggregateOutputType | null
    _min: DashboardConfigMinAggregateOutputType | null
    _max: DashboardConfigMaxAggregateOutputType | null
  }

  export type DashboardConfigAvgAggregateOutputType = {
    refreshIntervalSeconds: number | null
    version: number | null
  }

  export type DashboardConfigSumAggregateOutputType = {
    refreshIntervalSeconds: number | null
    version: number | null
  }

  export type DashboardConfigMinAggregateOutputType = {
    id: string | null
    userId: string | null
    dashboardName: string | null
    description: string | null
    isDefault: boolean | null
    isPublic: boolean | null
    refreshIntervalSeconds: number | null
    version: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DashboardConfigMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    dashboardName: string | null
    description: string | null
    isDefault: boolean | null
    isPublic: boolean | null
    refreshIntervalSeconds: number | null
    version: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DashboardConfigCountAggregateOutputType = {
    id: number
    userId: number
    dashboardName: number
    description: number
    widgetLayout: number
    isDefault: number
    isPublic: number
    refreshIntervalSeconds: number
    sharedWithRoles: number
    version: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type DashboardConfigAvgAggregateInputType = {
    refreshIntervalSeconds?: true
    version?: true
  }

  export type DashboardConfigSumAggregateInputType = {
    refreshIntervalSeconds?: true
    version?: true
  }

  export type DashboardConfigMinAggregateInputType = {
    id?: true
    userId?: true
    dashboardName?: true
    description?: true
    isDefault?: true
    isPublic?: true
    refreshIntervalSeconds?: true
    version?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DashboardConfigMaxAggregateInputType = {
    id?: true
    userId?: true
    dashboardName?: true
    description?: true
    isDefault?: true
    isPublic?: true
    refreshIntervalSeconds?: true
    version?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DashboardConfigCountAggregateInputType = {
    id?: true
    userId?: true
    dashboardName?: true
    description?: true
    widgetLayout?: true
    isDefault?: true
    isPublic?: true
    refreshIntervalSeconds?: true
    sharedWithRoles?: true
    version?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type DashboardConfigAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DashboardConfig to aggregate.
     */
    where?: DashboardConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DashboardConfigs to fetch.
     */
    orderBy?: DashboardConfigOrderByWithRelationInput | DashboardConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DashboardConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DashboardConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DashboardConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DashboardConfigs
    **/
    _count?: true | DashboardConfigCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DashboardConfigAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DashboardConfigSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DashboardConfigMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DashboardConfigMaxAggregateInputType
  }

  export type GetDashboardConfigAggregateType<T extends DashboardConfigAggregateArgs> = {
        [P in keyof T & keyof AggregateDashboardConfig]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDashboardConfig[P]>
      : GetScalarType<T[P], AggregateDashboardConfig[P]>
  }




  export type DashboardConfigGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DashboardConfigWhereInput
    orderBy?: DashboardConfigOrderByWithAggregationInput | DashboardConfigOrderByWithAggregationInput[]
    by: DashboardConfigScalarFieldEnum[] | DashboardConfigScalarFieldEnum
    having?: DashboardConfigScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DashboardConfigCountAggregateInputType | true
    _avg?: DashboardConfigAvgAggregateInputType
    _sum?: DashboardConfigSumAggregateInputType
    _min?: DashboardConfigMinAggregateInputType
    _max?: DashboardConfigMaxAggregateInputType
  }

  export type DashboardConfigGroupByOutputType = {
    id: string
    userId: string
    dashboardName: string
    description: string | null
    widgetLayout: JsonValue
    isDefault: boolean
    isPublic: boolean
    refreshIntervalSeconds: number
    sharedWithRoles: JsonValue
    version: number
    createdAt: Date
    updatedAt: Date
    _count: DashboardConfigCountAggregateOutputType | null
    _avg: DashboardConfigAvgAggregateOutputType | null
    _sum: DashboardConfigSumAggregateOutputType | null
    _min: DashboardConfigMinAggregateOutputType | null
    _max: DashboardConfigMaxAggregateOutputType | null
  }

  type GetDashboardConfigGroupByPayload<T extends DashboardConfigGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DashboardConfigGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DashboardConfigGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DashboardConfigGroupByOutputType[P]>
            : GetScalarType<T[P], DashboardConfigGroupByOutputType[P]>
        }
      >
    >


  export type DashboardConfigSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    dashboardName?: boolean
    description?: boolean
    widgetLayout?: boolean
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: boolean
    sharedWithRoles?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["dashboardConfig"]>

  export type DashboardConfigSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    dashboardName?: boolean
    description?: boolean
    widgetLayout?: boolean
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: boolean
    sharedWithRoles?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["dashboardConfig"]>

  export type DashboardConfigSelectScalar = {
    id?: boolean
    userId?: boolean
    dashboardName?: boolean
    description?: boolean
    widgetLayout?: boolean
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: boolean
    sharedWithRoles?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type DashboardConfigInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type DashboardConfigIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $DashboardConfigPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DashboardConfig"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      dashboardName: string
      description: string | null
      widgetLayout: Prisma.JsonValue
      isDefault: boolean
      isPublic: boolean
      refreshIntervalSeconds: number
      sharedWithRoles: Prisma.JsonValue
      version: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["dashboardConfig"]>
    composites: {}
  }

  type DashboardConfigGetPayload<S extends boolean | null | undefined | DashboardConfigDefaultArgs> = $Result.GetResult<Prisma.$DashboardConfigPayload, S>

  type DashboardConfigCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<DashboardConfigFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: DashboardConfigCountAggregateInputType | true
    }

  export interface DashboardConfigDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DashboardConfig'], meta: { name: 'DashboardConfig' } }
    /**
     * Find zero or one DashboardConfig that matches the filter.
     * @param {DashboardConfigFindUniqueArgs} args - Arguments to find a DashboardConfig
     * @example
     * // Get one DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DashboardConfigFindUniqueArgs>(args: SelectSubset<T, DashboardConfigFindUniqueArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one DashboardConfig that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {DashboardConfigFindUniqueOrThrowArgs} args - Arguments to find a DashboardConfig
     * @example
     * // Get one DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DashboardConfigFindUniqueOrThrowArgs>(args: SelectSubset<T, DashboardConfigFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first DashboardConfig that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigFindFirstArgs} args - Arguments to find a DashboardConfig
     * @example
     * // Get one DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DashboardConfigFindFirstArgs>(args?: SelectSubset<T, DashboardConfigFindFirstArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first DashboardConfig that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigFindFirstOrThrowArgs} args - Arguments to find a DashboardConfig
     * @example
     * // Get one DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DashboardConfigFindFirstOrThrowArgs>(args?: SelectSubset<T, DashboardConfigFindFirstOrThrowArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more DashboardConfigs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DashboardConfigs
     * const dashboardConfigs = await prisma.dashboardConfig.findMany()
     * 
     * // Get first 10 DashboardConfigs
     * const dashboardConfigs = await prisma.dashboardConfig.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const dashboardConfigWithIdOnly = await prisma.dashboardConfig.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DashboardConfigFindManyArgs>(args?: SelectSubset<T, DashboardConfigFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a DashboardConfig.
     * @param {DashboardConfigCreateArgs} args - Arguments to create a DashboardConfig.
     * @example
     * // Create one DashboardConfig
     * const DashboardConfig = await prisma.dashboardConfig.create({
     *   data: {
     *     // ... data to create a DashboardConfig
     *   }
     * })
     * 
     */
    create<T extends DashboardConfigCreateArgs>(args: SelectSubset<T, DashboardConfigCreateArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many DashboardConfigs.
     * @param {DashboardConfigCreateManyArgs} args - Arguments to create many DashboardConfigs.
     * @example
     * // Create many DashboardConfigs
     * const dashboardConfig = await prisma.dashboardConfig.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DashboardConfigCreateManyArgs>(args?: SelectSubset<T, DashboardConfigCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DashboardConfigs and returns the data saved in the database.
     * @param {DashboardConfigCreateManyAndReturnArgs} args - Arguments to create many DashboardConfigs.
     * @example
     * // Create many DashboardConfigs
     * const dashboardConfig = await prisma.dashboardConfig.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DashboardConfigs and only return the `id`
     * const dashboardConfigWithIdOnly = await prisma.dashboardConfig.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DashboardConfigCreateManyAndReturnArgs>(args?: SelectSubset<T, DashboardConfigCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a DashboardConfig.
     * @param {DashboardConfigDeleteArgs} args - Arguments to delete one DashboardConfig.
     * @example
     * // Delete one DashboardConfig
     * const DashboardConfig = await prisma.dashboardConfig.delete({
     *   where: {
     *     // ... filter to delete one DashboardConfig
     *   }
     * })
     * 
     */
    delete<T extends DashboardConfigDeleteArgs>(args: SelectSubset<T, DashboardConfigDeleteArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one DashboardConfig.
     * @param {DashboardConfigUpdateArgs} args - Arguments to update one DashboardConfig.
     * @example
     * // Update one DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DashboardConfigUpdateArgs>(args: SelectSubset<T, DashboardConfigUpdateArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more DashboardConfigs.
     * @param {DashboardConfigDeleteManyArgs} args - Arguments to filter DashboardConfigs to delete.
     * @example
     * // Delete a few DashboardConfigs
     * const { count } = await prisma.dashboardConfig.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DashboardConfigDeleteManyArgs>(args?: SelectSubset<T, DashboardConfigDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DashboardConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DashboardConfigs
     * const dashboardConfig = await prisma.dashboardConfig.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DashboardConfigUpdateManyArgs>(args: SelectSubset<T, DashboardConfigUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one DashboardConfig.
     * @param {DashboardConfigUpsertArgs} args - Arguments to update or create a DashboardConfig.
     * @example
     * // Update or create a DashboardConfig
     * const dashboardConfig = await prisma.dashboardConfig.upsert({
     *   create: {
     *     // ... data to create a DashboardConfig
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DashboardConfig we want to update
     *   }
     * })
     */
    upsert<T extends DashboardConfigUpsertArgs>(args: SelectSubset<T, DashboardConfigUpsertArgs<ExtArgs>>): Prisma__DashboardConfigClient<$Result.GetResult<Prisma.$DashboardConfigPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of DashboardConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigCountArgs} args - Arguments to filter DashboardConfigs to count.
     * @example
     * // Count the number of DashboardConfigs
     * const count = await prisma.dashboardConfig.count({
     *   where: {
     *     // ... the filter for the DashboardConfigs we want to count
     *   }
     * })
    **/
    count<T extends DashboardConfigCountArgs>(
      args?: Subset<T, DashboardConfigCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DashboardConfigCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DashboardConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DashboardConfigAggregateArgs>(args: Subset<T, DashboardConfigAggregateArgs>): Prisma.PrismaPromise<GetDashboardConfigAggregateType<T>>

    /**
     * Group by DashboardConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DashboardConfigGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DashboardConfigGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DashboardConfigGroupByArgs['orderBy'] }
        : { orderBy?: DashboardConfigGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DashboardConfigGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDashboardConfigGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DashboardConfig model
   */
  readonly fields: DashboardConfigFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DashboardConfig.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DashboardConfigClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DashboardConfig model
   */ 
  interface DashboardConfigFieldRefs {
    readonly id: FieldRef<"DashboardConfig", 'String'>
    readonly userId: FieldRef<"DashboardConfig", 'String'>
    readonly dashboardName: FieldRef<"DashboardConfig", 'String'>
    readonly description: FieldRef<"DashboardConfig", 'String'>
    readonly widgetLayout: FieldRef<"DashboardConfig", 'Json'>
    readonly isDefault: FieldRef<"DashboardConfig", 'Boolean'>
    readonly isPublic: FieldRef<"DashboardConfig", 'Boolean'>
    readonly refreshIntervalSeconds: FieldRef<"DashboardConfig", 'Int'>
    readonly sharedWithRoles: FieldRef<"DashboardConfig", 'Json'>
    readonly version: FieldRef<"DashboardConfig", 'Int'>
    readonly createdAt: FieldRef<"DashboardConfig", 'DateTime'>
    readonly updatedAt: FieldRef<"DashboardConfig", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DashboardConfig findUnique
   */
  export type DashboardConfigFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter, which DashboardConfig to fetch.
     */
    where: DashboardConfigWhereUniqueInput
  }

  /**
   * DashboardConfig findUniqueOrThrow
   */
  export type DashboardConfigFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter, which DashboardConfig to fetch.
     */
    where: DashboardConfigWhereUniqueInput
  }

  /**
   * DashboardConfig findFirst
   */
  export type DashboardConfigFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter, which DashboardConfig to fetch.
     */
    where?: DashboardConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DashboardConfigs to fetch.
     */
    orderBy?: DashboardConfigOrderByWithRelationInput | DashboardConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DashboardConfigs.
     */
    cursor?: DashboardConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DashboardConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DashboardConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DashboardConfigs.
     */
    distinct?: DashboardConfigScalarFieldEnum | DashboardConfigScalarFieldEnum[]
  }

  /**
   * DashboardConfig findFirstOrThrow
   */
  export type DashboardConfigFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter, which DashboardConfig to fetch.
     */
    where?: DashboardConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DashboardConfigs to fetch.
     */
    orderBy?: DashboardConfigOrderByWithRelationInput | DashboardConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DashboardConfigs.
     */
    cursor?: DashboardConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DashboardConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DashboardConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DashboardConfigs.
     */
    distinct?: DashboardConfigScalarFieldEnum | DashboardConfigScalarFieldEnum[]
  }

  /**
   * DashboardConfig findMany
   */
  export type DashboardConfigFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter, which DashboardConfigs to fetch.
     */
    where?: DashboardConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DashboardConfigs to fetch.
     */
    orderBy?: DashboardConfigOrderByWithRelationInput | DashboardConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DashboardConfigs.
     */
    cursor?: DashboardConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DashboardConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DashboardConfigs.
     */
    skip?: number
    distinct?: DashboardConfigScalarFieldEnum | DashboardConfigScalarFieldEnum[]
  }

  /**
   * DashboardConfig create
   */
  export type DashboardConfigCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * The data needed to create a DashboardConfig.
     */
    data: XOR<DashboardConfigCreateInput, DashboardConfigUncheckedCreateInput>
  }

  /**
   * DashboardConfig createMany
   */
  export type DashboardConfigCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DashboardConfigs.
     */
    data: DashboardConfigCreateManyInput | DashboardConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DashboardConfig createManyAndReturn
   */
  export type DashboardConfigCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many DashboardConfigs.
     */
    data: DashboardConfigCreateManyInput | DashboardConfigCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * DashboardConfig update
   */
  export type DashboardConfigUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * The data needed to update a DashboardConfig.
     */
    data: XOR<DashboardConfigUpdateInput, DashboardConfigUncheckedUpdateInput>
    /**
     * Choose, which DashboardConfig to update.
     */
    where: DashboardConfigWhereUniqueInput
  }

  /**
   * DashboardConfig updateMany
   */
  export type DashboardConfigUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DashboardConfigs.
     */
    data: XOR<DashboardConfigUpdateManyMutationInput, DashboardConfigUncheckedUpdateManyInput>
    /**
     * Filter which DashboardConfigs to update
     */
    where?: DashboardConfigWhereInput
  }

  /**
   * DashboardConfig upsert
   */
  export type DashboardConfigUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * The filter to search for the DashboardConfig to update in case it exists.
     */
    where: DashboardConfigWhereUniqueInput
    /**
     * In case the DashboardConfig found by the `where` argument doesn't exist, create a new DashboardConfig with this data.
     */
    create: XOR<DashboardConfigCreateInput, DashboardConfigUncheckedCreateInput>
    /**
     * In case the DashboardConfig was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DashboardConfigUpdateInput, DashboardConfigUncheckedUpdateInput>
  }

  /**
   * DashboardConfig delete
   */
  export type DashboardConfigDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
    /**
     * Filter which DashboardConfig to delete.
     */
    where: DashboardConfigWhereUniqueInput
  }

  /**
   * DashboardConfig deleteMany
   */
  export type DashboardConfigDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DashboardConfigs to delete
     */
    where?: DashboardConfigWhereInput
  }

  /**
   * DashboardConfig without action
   */
  export type DashboardConfigDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DashboardConfig
     */
    select?: DashboardConfigSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DashboardConfigInclude<ExtArgs> | null
  }


  /**
   * Model ActivityData
   */

  export type AggregateActivityData = {
    _count: ActivityDataCountAggregateOutputType | null
    _avg: ActivityDataAvgAggregateOutputType | null
    _sum: ActivityDataSumAggregateOutputType | null
    _min: ActivityDataMinAggregateOutputType | null
    _max: ActivityDataMaxAggregateOutputType | null
  }

  export type ActivityDataAvgAggregateOutputType = {
    priority: number | null
    duration: number | null
  }

  export type ActivityDataSumAggregateOutputType = {
    priority: number | null
    duration: number | null
  }

  export type ActivityDataMinAggregateOutputType = {
    id: string | null
    userId: string | null
    actionName: string | null
    actionDescription: string | null
    targetName: string | null
    targetType: string | null
    status: string | null
    priority: number | null
    isAutomated: boolean | null
    timestamp: Date | null
    duration: number | null
    completedAt: Date | null
    projectId: string | null
    errorMessage: string | null
    errorCode: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ActivityDataMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    actionName: string | null
    actionDescription: string | null
    targetName: string | null
    targetType: string | null
    status: string | null
    priority: number | null
    isAutomated: boolean | null
    timestamp: Date | null
    duration: number | null
    completedAt: Date | null
    projectId: string | null
    errorMessage: string | null
    errorCode: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ActivityDataCountAggregateOutputType = {
    id: number
    userId: number
    actionName: number
    actionDescription: number
    targetName: number
    targetType: number
    status: number
    priority: number
    isAutomated: number
    timestamp: number
    duration: number
    completedAt: number
    metadata: number
    tags: number
    projectId: number
    errorMessage: number
    errorCode: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ActivityDataAvgAggregateInputType = {
    priority?: true
    duration?: true
  }

  export type ActivityDataSumAggregateInputType = {
    priority?: true
    duration?: true
  }

  export type ActivityDataMinAggregateInputType = {
    id?: true
    userId?: true
    actionName?: true
    actionDescription?: true
    targetName?: true
    targetType?: true
    status?: true
    priority?: true
    isAutomated?: true
    timestamp?: true
    duration?: true
    completedAt?: true
    projectId?: true
    errorMessage?: true
    errorCode?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ActivityDataMaxAggregateInputType = {
    id?: true
    userId?: true
    actionName?: true
    actionDescription?: true
    targetName?: true
    targetType?: true
    status?: true
    priority?: true
    isAutomated?: true
    timestamp?: true
    duration?: true
    completedAt?: true
    projectId?: true
    errorMessage?: true
    errorCode?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ActivityDataCountAggregateInputType = {
    id?: true
    userId?: true
    actionName?: true
    actionDescription?: true
    targetName?: true
    targetType?: true
    status?: true
    priority?: true
    isAutomated?: true
    timestamp?: true
    duration?: true
    completedAt?: true
    metadata?: true
    tags?: true
    projectId?: true
    errorMessage?: true
    errorCode?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ActivityDataAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ActivityData to aggregate.
     */
    where?: ActivityDataWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityData to fetch.
     */
    orderBy?: ActivityDataOrderByWithRelationInput | ActivityDataOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ActivityDataWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityData from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityData.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ActivityData
    **/
    _count?: true | ActivityDataCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ActivityDataAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ActivityDataSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ActivityDataMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ActivityDataMaxAggregateInputType
  }

  export type GetActivityDataAggregateType<T extends ActivityDataAggregateArgs> = {
        [P in keyof T & keyof AggregateActivityData]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateActivityData[P]>
      : GetScalarType<T[P], AggregateActivityData[P]>
  }




  export type ActivityDataGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ActivityDataWhereInput
    orderBy?: ActivityDataOrderByWithAggregationInput | ActivityDataOrderByWithAggregationInput[]
    by: ActivityDataScalarFieldEnum[] | ActivityDataScalarFieldEnum
    having?: ActivityDataScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ActivityDataCountAggregateInputType | true
    _avg?: ActivityDataAvgAggregateInputType
    _sum?: ActivityDataSumAggregateInputType
    _min?: ActivityDataMinAggregateInputType
    _max?: ActivityDataMaxAggregateInputType
  }

  export type ActivityDataGroupByOutputType = {
    id: string
    userId: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType: string
    status: string
    priority: number
    isAutomated: boolean
    timestamp: Date
    duration: number | null
    completedAt: Date | null
    metadata: JsonValue | null
    tags: JsonValue
    projectId: string | null
    errorMessage: string | null
    errorCode: string | null
    createdAt: Date
    updatedAt: Date
    _count: ActivityDataCountAggregateOutputType | null
    _avg: ActivityDataAvgAggregateOutputType | null
    _sum: ActivityDataSumAggregateOutputType | null
    _min: ActivityDataMinAggregateOutputType | null
    _max: ActivityDataMaxAggregateOutputType | null
  }

  type GetActivityDataGroupByPayload<T extends ActivityDataGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ActivityDataGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ActivityDataGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ActivityDataGroupByOutputType[P]>
            : GetScalarType<T[P], ActivityDataGroupByOutputType[P]>
        }
      >
    >


  export type ActivityDataSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    actionName?: boolean
    actionDescription?: boolean
    targetName?: boolean
    targetType?: boolean
    status?: boolean
    priority?: boolean
    isAutomated?: boolean
    timestamp?: boolean
    duration?: boolean
    completedAt?: boolean
    metadata?: boolean
    tags?: boolean
    projectId?: boolean
    errorMessage?: boolean
    errorCode?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["activityData"]>

  export type ActivityDataSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    actionName?: boolean
    actionDescription?: boolean
    targetName?: boolean
    targetType?: boolean
    status?: boolean
    priority?: boolean
    isAutomated?: boolean
    timestamp?: boolean
    duration?: boolean
    completedAt?: boolean
    metadata?: boolean
    tags?: boolean
    projectId?: boolean
    errorMessage?: boolean
    errorCode?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["activityData"]>

  export type ActivityDataSelectScalar = {
    id?: boolean
    userId?: boolean
    actionName?: boolean
    actionDescription?: boolean
    targetName?: boolean
    targetType?: boolean
    status?: boolean
    priority?: boolean
    isAutomated?: boolean
    timestamp?: boolean
    duration?: boolean
    completedAt?: boolean
    metadata?: boolean
    tags?: boolean
    projectId?: boolean
    errorMessage?: boolean
    errorCode?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ActivityDataInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ActivityDataIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ActivityDataPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ActivityData"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      actionName: string
      actionDescription: string
      targetName: string
      targetType: string
      status: string
      priority: number
      isAutomated: boolean
      timestamp: Date
      duration: number | null
      completedAt: Date | null
      metadata: Prisma.JsonValue | null
      tags: Prisma.JsonValue
      projectId: string | null
      errorMessage: string | null
      errorCode: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["activityData"]>
    composites: {}
  }

  type ActivityDataGetPayload<S extends boolean | null | undefined | ActivityDataDefaultArgs> = $Result.GetResult<Prisma.$ActivityDataPayload, S>

  type ActivityDataCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ActivityDataFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ActivityDataCountAggregateInputType | true
    }

  export interface ActivityDataDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ActivityData'], meta: { name: 'ActivityData' } }
    /**
     * Find zero or one ActivityData that matches the filter.
     * @param {ActivityDataFindUniqueArgs} args - Arguments to find a ActivityData
     * @example
     * // Get one ActivityData
     * const activityData = await prisma.activityData.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ActivityDataFindUniqueArgs>(args: SelectSubset<T, ActivityDataFindUniqueArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ActivityData that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ActivityDataFindUniqueOrThrowArgs} args - Arguments to find a ActivityData
     * @example
     * // Get one ActivityData
     * const activityData = await prisma.activityData.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ActivityDataFindUniqueOrThrowArgs>(args: SelectSubset<T, ActivityDataFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ActivityData that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataFindFirstArgs} args - Arguments to find a ActivityData
     * @example
     * // Get one ActivityData
     * const activityData = await prisma.activityData.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ActivityDataFindFirstArgs>(args?: SelectSubset<T, ActivityDataFindFirstArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ActivityData that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataFindFirstOrThrowArgs} args - Arguments to find a ActivityData
     * @example
     * // Get one ActivityData
     * const activityData = await prisma.activityData.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ActivityDataFindFirstOrThrowArgs>(args?: SelectSubset<T, ActivityDataFindFirstOrThrowArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ActivityData that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ActivityData
     * const activityData = await prisma.activityData.findMany()
     * 
     * // Get first 10 ActivityData
     * const activityData = await prisma.activityData.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const activityDataWithIdOnly = await prisma.activityData.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ActivityDataFindManyArgs>(args?: SelectSubset<T, ActivityDataFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ActivityData.
     * @param {ActivityDataCreateArgs} args - Arguments to create a ActivityData.
     * @example
     * // Create one ActivityData
     * const ActivityData = await prisma.activityData.create({
     *   data: {
     *     // ... data to create a ActivityData
     *   }
     * })
     * 
     */
    create<T extends ActivityDataCreateArgs>(args: SelectSubset<T, ActivityDataCreateArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ActivityData.
     * @param {ActivityDataCreateManyArgs} args - Arguments to create many ActivityData.
     * @example
     * // Create many ActivityData
     * const activityData = await prisma.activityData.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ActivityDataCreateManyArgs>(args?: SelectSubset<T, ActivityDataCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ActivityData and returns the data saved in the database.
     * @param {ActivityDataCreateManyAndReturnArgs} args - Arguments to create many ActivityData.
     * @example
     * // Create many ActivityData
     * const activityData = await prisma.activityData.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ActivityData and only return the `id`
     * const activityDataWithIdOnly = await prisma.activityData.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ActivityDataCreateManyAndReturnArgs>(args?: SelectSubset<T, ActivityDataCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ActivityData.
     * @param {ActivityDataDeleteArgs} args - Arguments to delete one ActivityData.
     * @example
     * // Delete one ActivityData
     * const ActivityData = await prisma.activityData.delete({
     *   where: {
     *     // ... filter to delete one ActivityData
     *   }
     * })
     * 
     */
    delete<T extends ActivityDataDeleteArgs>(args: SelectSubset<T, ActivityDataDeleteArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ActivityData.
     * @param {ActivityDataUpdateArgs} args - Arguments to update one ActivityData.
     * @example
     * // Update one ActivityData
     * const activityData = await prisma.activityData.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ActivityDataUpdateArgs>(args: SelectSubset<T, ActivityDataUpdateArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ActivityData.
     * @param {ActivityDataDeleteManyArgs} args - Arguments to filter ActivityData to delete.
     * @example
     * // Delete a few ActivityData
     * const { count } = await prisma.activityData.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ActivityDataDeleteManyArgs>(args?: SelectSubset<T, ActivityDataDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ActivityData.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ActivityData
     * const activityData = await prisma.activityData.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ActivityDataUpdateManyArgs>(args: SelectSubset<T, ActivityDataUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ActivityData.
     * @param {ActivityDataUpsertArgs} args - Arguments to update or create a ActivityData.
     * @example
     * // Update or create a ActivityData
     * const activityData = await prisma.activityData.upsert({
     *   create: {
     *     // ... data to create a ActivityData
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ActivityData we want to update
     *   }
     * })
     */
    upsert<T extends ActivityDataUpsertArgs>(args: SelectSubset<T, ActivityDataUpsertArgs<ExtArgs>>): Prisma__ActivityDataClient<$Result.GetResult<Prisma.$ActivityDataPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ActivityData.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataCountArgs} args - Arguments to filter ActivityData to count.
     * @example
     * // Count the number of ActivityData
     * const count = await prisma.activityData.count({
     *   where: {
     *     // ... the filter for the ActivityData we want to count
     *   }
     * })
    **/
    count<T extends ActivityDataCountArgs>(
      args?: Subset<T, ActivityDataCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ActivityDataCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ActivityData.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ActivityDataAggregateArgs>(args: Subset<T, ActivityDataAggregateArgs>): Prisma.PrismaPromise<GetActivityDataAggregateType<T>>

    /**
     * Group by ActivityData.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityDataGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ActivityDataGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ActivityDataGroupByArgs['orderBy'] }
        : { orderBy?: ActivityDataGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ActivityDataGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetActivityDataGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ActivityData model
   */
  readonly fields: ActivityDataFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ActivityData.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ActivityDataClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ActivityData model
   */ 
  interface ActivityDataFieldRefs {
    readonly id: FieldRef<"ActivityData", 'String'>
    readonly userId: FieldRef<"ActivityData", 'String'>
    readonly actionName: FieldRef<"ActivityData", 'String'>
    readonly actionDescription: FieldRef<"ActivityData", 'String'>
    readonly targetName: FieldRef<"ActivityData", 'String'>
    readonly targetType: FieldRef<"ActivityData", 'String'>
    readonly status: FieldRef<"ActivityData", 'String'>
    readonly priority: FieldRef<"ActivityData", 'Int'>
    readonly isAutomated: FieldRef<"ActivityData", 'Boolean'>
    readonly timestamp: FieldRef<"ActivityData", 'DateTime'>
    readonly duration: FieldRef<"ActivityData", 'Int'>
    readonly completedAt: FieldRef<"ActivityData", 'DateTime'>
    readonly metadata: FieldRef<"ActivityData", 'Json'>
    readonly tags: FieldRef<"ActivityData", 'Json'>
    readonly projectId: FieldRef<"ActivityData", 'String'>
    readonly errorMessage: FieldRef<"ActivityData", 'String'>
    readonly errorCode: FieldRef<"ActivityData", 'String'>
    readonly createdAt: FieldRef<"ActivityData", 'DateTime'>
    readonly updatedAt: FieldRef<"ActivityData", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ActivityData findUnique
   */
  export type ActivityDataFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter, which ActivityData to fetch.
     */
    where: ActivityDataWhereUniqueInput
  }

  /**
   * ActivityData findUniqueOrThrow
   */
  export type ActivityDataFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter, which ActivityData to fetch.
     */
    where: ActivityDataWhereUniqueInput
  }

  /**
   * ActivityData findFirst
   */
  export type ActivityDataFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter, which ActivityData to fetch.
     */
    where?: ActivityDataWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityData to fetch.
     */
    orderBy?: ActivityDataOrderByWithRelationInput | ActivityDataOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ActivityData.
     */
    cursor?: ActivityDataWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityData from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityData.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ActivityData.
     */
    distinct?: ActivityDataScalarFieldEnum | ActivityDataScalarFieldEnum[]
  }

  /**
   * ActivityData findFirstOrThrow
   */
  export type ActivityDataFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter, which ActivityData to fetch.
     */
    where?: ActivityDataWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityData to fetch.
     */
    orderBy?: ActivityDataOrderByWithRelationInput | ActivityDataOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ActivityData.
     */
    cursor?: ActivityDataWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityData from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityData.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ActivityData.
     */
    distinct?: ActivityDataScalarFieldEnum | ActivityDataScalarFieldEnum[]
  }

  /**
   * ActivityData findMany
   */
  export type ActivityDataFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter, which ActivityData to fetch.
     */
    where?: ActivityDataWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityData to fetch.
     */
    orderBy?: ActivityDataOrderByWithRelationInput | ActivityDataOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ActivityData.
     */
    cursor?: ActivityDataWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityData from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityData.
     */
    skip?: number
    distinct?: ActivityDataScalarFieldEnum | ActivityDataScalarFieldEnum[]
  }

  /**
   * ActivityData create
   */
  export type ActivityDataCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * The data needed to create a ActivityData.
     */
    data: XOR<ActivityDataCreateInput, ActivityDataUncheckedCreateInput>
  }

  /**
   * ActivityData createMany
   */
  export type ActivityDataCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ActivityData.
     */
    data: ActivityDataCreateManyInput | ActivityDataCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ActivityData createManyAndReturn
   */
  export type ActivityDataCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ActivityData.
     */
    data: ActivityDataCreateManyInput | ActivityDataCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ActivityData update
   */
  export type ActivityDataUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * The data needed to update a ActivityData.
     */
    data: XOR<ActivityDataUpdateInput, ActivityDataUncheckedUpdateInput>
    /**
     * Choose, which ActivityData to update.
     */
    where: ActivityDataWhereUniqueInput
  }

  /**
   * ActivityData updateMany
   */
  export type ActivityDataUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ActivityData.
     */
    data: XOR<ActivityDataUpdateManyMutationInput, ActivityDataUncheckedUpdateManyInput>
    /**
     * Filter which ActivityData to update
     */
    where?: ActivityDataWhereInput
  }

  /**
   * ActivityData upsert
   */
  export type ActivityDataUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * The filter to search for the ActivityData to update in case it exists.
     */
    where: ActivityDataWhereUniqueInput
    /**
     * In case the ActivityData found by the `where` argument doesn't exist, create a new ActivityData with this data.
     */
    create: XOR<ActivityDataCreateInput, ActivityDataUncheckedCreateInput>
    /**
     * In case the ActivityData was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ActivityDataUpdateInput, ActivityDataUncheckedUpdateInput>
  }

  /**
   * ActivityData delete
   */
  export type ActivityDataDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
    /**
     * Filter which ActivityData to delete.
     */
    where: ActivityDataWhereUniqueInput
  }

  /**
   * ActivityData deleteMany
   */
  export type ActivityDataDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ActivityData to delete
     */
    where?: ActivityDataWhereInput
  }

  /**
   * ActivityData without action
   */
  export type ActivityDataDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityData
     */
    select?: ActivityDataSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityDataInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const TenantScalarFieldEnum: {
    id: 'id',
    name: 'name',
    domain: 'domain',
    schemaName: 'schemaName',
    subscriptionPlan: 'subscriptionPlan',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    isActive: 'isActive',
    metadata: 'metadata',
    adminEmail: 'adminEmail',
    billingEmail: 'billingEmail',
    dataRegion: 'dataRegion',
    complianceSettings: 'complianceSettings'
  };

  export type TenantScalarFieldEnum = (typeof TenantScalarFieldEnum)[keyof typeof TenantScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    firstName: 'firstName',
    lastName: 'lastName',
    role: 'role',
    password: 'password',
    ssoProvider: 'ssoProvider',
    ssoUserId: 'ssoUserId',
    lastLogin: 'lastLogin',
    loginCount: 'loginCount',
    timezone: 'timezone',
    preferences: 'preferences',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const MetricsSessionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    sessionStart: 'sessionStart',
    sessionEnd: 'sessionEnd',
    totalDurationMs: 'totalDurationMs',
    toolsUsed: 'toolsUsed',
    productivityScore: 'productivityScore',
    sessionType: 'sessionType',
    projectId: 'projectId',
    tags: 'tags',
    interruptionsCount: 'interruptionsCount',
    focusTimeMs: 'focusTimeMs',
    description: 'description',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MetricsSessionScalarFieldEnum = (typeof MetricsSessionScalarFieldEnum)[keyof typeof MetricsSessionScalarFieldEnum]


  export const ToolMetricScalarFieldEnum: {
    id: 'id',
    sessionId: 'sessionId',
    toolName: 'toolName',
    toolCategory: 'toolCategory',
    executionCount: 'executionCount',
    totalDurationMs: 'totalDurationMs',
    averageDurationMs: 'averageDurationMs',
    successRate: 'successRate',
    errorCount: 'errorCount',
    memoryUsageMb: 'memoryUsageMb',
    cpuTimeMs: 'cpuTimeMs',
    parameters: 'parameters',
    outputSizeBytes: 'outputSizeBytes',
    commandLine: 'commandLine',
    workingDirectory: 'workingDirectory',
    createdAt: 'createdAt'
  };

  export type ToolMetricScalarFieldEnum = (typeof ToolMetricScalarFieldEnum)[keyof typeof ToolMetricScalarFieldEnum]


  export const DashboardConfigScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    dashboardName: 'dashboardName',
    description: 'description',
    widgetLayout: 'widgetLayout',
    isDefault: 'isDefault',
    isPublic: 'isPublic',
    refreshIntervalSeconds: 'refreshIntervalSeconds',
    sharedWithRoles: 'sharedWithRoles',
    version: 'version',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type DashboardConfigScalarFieldEnum = (typeof DashboardConfigScalarFieldEnum)[keyof typeof DashboardConfigScalarFieldEnum]


  export const ActivityDataScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    actionName: 'actionName',
    actionDescription: 'actionDescription',
    targetName: 'targetName',
    targetType: 'targetType',
    status: 'status',
    priority: 'priority',
    isAutomated: 'isAutomated',
    timestamp: 'timestamp',
    duration: 'duration',
    completedAt: 'completedAt',
    metadata: 'metadata',
    tags: 'tags',
    projectId: 'projectId',
    errorMessage: 'errorMessage',
    errorCode: 'errorCode',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ActivityDataScalarFieldEnum = (typeof ActivityDataScalarFieldEnum)[keyof typeof ActivityDataScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type TenantWhereInput = {
    AND?: TenantWhereInput | TenantWhereInput[]
    OR?: TenantWhereInput[]
    NOT?: TenantWhereInput | TenantWhereInput[]
    id?: UuidFilter<"Tenant"> | string
    name?: StringFilter<"Tenant"> | string
    domain?: StringFilter<"Tenant"> | string
    schemaName?: StringFilter<"Tenant"> | string
    subscriptionPlan?: StringFilter<"Tenant"> | string
    createdAt?: DateTimeFilter<"Tenant"> | Date | string
    updatedAt?: DateTimeFilter<"Tenant"> | Date | string
    isActive?: BoolFilter<"Tenant"> | boolean
    metadata?: JsonFilter<"Tenant">
    adminEmail?: StringNullableFilter<"Tenant"> | string | null
    billingEmail?: StringNullableFilter<"Tenant"> | string | null
    dataRegion?: StringFilter<"Tenant"> | string
    complianceSettings?: JsonFilter<"Tenant">
  }

  export type TenantOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    schemaName?: SortOrder
    subscriptionPlan?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isActive?: SortOrder
    metadata?: SortOrder
    adminEmail?: SortOrderInput | SortOrder
    billingEmail?: SortOrderInput | SortOrder
    dataRegion?: SortOrder
    complianceSettings?: SortOrder
  }

  export type TenantWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    domain?: string
    schemaName?: string
    AND?: TenantWhereInput | TenantWhereInput[]
    OR?: TenantWhereInput[]
    NOT?: TenantWhereInput | TenantWhereInput[]
    name?: StringFilter<"Tenant"> | string
    subscriptionPlan?: StringFilter<"Tenant"> | string
    createdAt?: DateTimeFilter<"Tenant"> | Date | string
    updatedAt?: DateTimeFilter<"Tenant"> | Date | string
    isActive?: BoolFilter<"Tenant"> | boolean
    metadata?: JsonFilter<"Tenant">
    adminEmail?: StringNullableFilter<"Tenant"> | string | null
    billingEmail?: StringNullableFilter<"Tenant"> | string | null
    dataRegion?: StringFilter<"Tenant"> | string
    complianceSettings?: JsonFilter<"Tenant">
  }, "id" | "domain" | "schemaName">

  export type TenantOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    schemaName?: SortOrder
    subscriptionPlan?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isActive?: SortOrder
    metadata?: SortOrder
    adminEmail?: SortOrderInput | SortOrder
    billingEmail?: SortOrderInput | SortOrder
    dataRegion?: SortOrder
    complianceSettings?: SortOrder
    _count?: TenantCountOrderByAggregateInput
    _max?: TenantMaxOrderByAggregateInput
    _min?: TenantMinOrderByAggregateInput
  }

  export type TenantScalarWhereWithAggregatesInput = {
    AND?: TenantScalarWhereWithAggregatesInput | TenantScalarWhereWithAggregatesInput[]
    OR?: TenantScalarWhereWithAggregatesInput[]
    NOT?: TenantScalarWhereWithAggregatesInput | TenantScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Tenant"> | string
    name?: StringWithAggregatesFilter<"Tenant"> | string
    domain?: StringWithAggregatesFilter<"Tenant"> | string
    schemaName?: StringWithAggregatesFilter<"Tenant"> | string
    subscriptionPlan?: StringWithAggregatesFilter<"Tenant"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Tenant"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Tenant"> | Date | string
    isActive?: BoolWithAggregatesFilter<"Tenant"> | boolean
    metadata?: JsonWithAggregatesFilter<"Tenant">
    adminEmail?: StringNullableWithAggregatesFilter<"Tenant"> | string | null
    billingEmail?: StringNullableWithAggregatesFilter<"Tenant"> | string | null
    dataRegion?: StringWithAggregatesFilter<"Tenant"> | string
    complianceSettings?: JsonWithAggregatesFilter<"Tenant">
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: UuidFilter<"User"> | string
    email?: StringFilter<"User"> | string
    firstName?: StringFilter<"User"> | string
    lastName?: StringFilter<"User"> | string
    role?: StringFilter<"User"> | string
    password?: StringNullableFilter<"User"> | string | null
    ssoProvider?: StringNullableFilter<"User"> | string | null
    ssoUserId?: StringNullableFilter<"User"> | string | null
    lastLogin?: DateTimeNullableFilter<"User"> | Date | string | null
    loginCount?: IntFilter<"User"> | number
    timezone?: StringFilter<"User"> | string
    preferences?: JsonFilter<"User">
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    metricsSessions?: MetricsSessionListRelationFilter
    dashboardConfigs?: DashboardConfigListRelationFilter
    activities?: ActivityDataListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    role?: SortOrder
    password?: SortOrderInput | SortOrder
    ssoProvider?: SortOrderInput | SortOrder
    ssoUserId?: SortOrderInput | SortOrder
    lastLogin?: SortOrderInput | SortOrder
    loginCount?: SortOrder
    timezone?: SortOrder
    preferences?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    metricsSessions?: MetricsSessionOrderByRelationAggregateInput
    dashboardConfigs?: DashboardConfigOrderByRelationAggregateInput
    activities?: ActivityDataOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    firstName?: StringFilter<"User"> | string
    lastName?: StringFilter<"User"> | string
    role?: StringFilter<"User"> | string
    password?: StringNullableFilter<"User"> | string | null
    ssoProvider?: StringNullableFilter<"User"> | string | null
    ssoUserId?: StringNullableFilter<"User"> | string | null
    lastLogin?: DateTimeNullableFilter<"User"> | Date | string | null
    loginCount?: IntFilter<"User"> | number
    timezone?: StringFilter<"User"> | string
    preferences?: JsonFilter<"User">
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    metricsSessions?: MetricsSessionListRelationFilter
    dashboardConfigs?: DashboardConfigListRelationFilter
    activities?: ActivityDataListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    role?: SortOrder
    password?: SortOrderInput | SortOrder
    ssoProvider?: SortOrderInput | SortOrder
    ssoUserId?: SortOrderInput | SortOrder
    lastLogin?: SortOrderInput | SortOrder
    loginCount?: SortOrder
    timezone?: SortOrder
    preferences?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    firstName?: StringWithAggregatesFilter<"User"> | string
    lastName?: StringWithAggregatesFilter<"User"> | string
    role?: StringWithAggregatesFilter<"User"> | string
    password?: StringNullableWithAggregatesFilter<"User"> | string | null
    ssoProvider?: StringNullableWithAggregatesFilter<"User"> | string | null
    ssoUserId?: StringNullableWithAggregatesFilter<"User"> | string | null
    lastLogin?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    loginCount?: IntWithAggregatesFilter<"User"> | number
    timezone?: StringWithAggregatesFilter<"User"> | string
    preferences?: JsonWithAggregatesFilter<"User">
    isActive?: BoolWithAggregatesFilter<"User"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type MetricsSessionWhereInput = {
    AND?: MetricsSessionWhereInput | MetricsSessionWhereInput[]
    OR?: MetricsSessionWhereInput[]
    NOT?: MetricsSessionWhereInput | MetricsSessionWhereInput[]
    id?: UuidFilter<"MetricsSession"> | string
    userId?: UuidFilter<"MetricsSession"> | string
    sessionStart?: DateTimeFilter<"MetricsSession"> | Date | string
    sessionEnd?: DateTimeNullableFilter<"MetricsSession"> | Date | string | null
    totalDurationMs?: BigIntNullableFilter<"MetricsSession"> | bigint | number | null
    toolsUsed?: JsonNullableFilter<"MetricsSession">
    productivityScore?: IntNullableFilter<"MetricsSession"> | number | null
    sessionType?: StringFilter<"MetricsSession"> | string
    projectId?: StringNullableFilter<"MetricsSession"> | string | null
    tags?: JsonFilter<"MetricsSession">
    interruptionsCount?: IntFilter<"MetricsSession"> | number
    focusTimeMs?: BigIntFilter<"MetricsSession"> | bigint | number
    description?: StringNullableFilter<"MetricsSession"> | string | null
    createdAt?: DateTimeFilter<"MetricsSession"> | Date | string
    updatedAt?: DateTimeFilter<"MetricsSession"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    toolMetrics?: ToolMetricListRelationFilter
  }

  export type MetricsSessionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    sessionStart?: SortOrder
    sessionEnd?: SortOrderInput | SortOrder
    totalDurationMs?: SortOrderInput | SortOrder
    toolsUsed?: SortOrderInput | SortOrder
    productivityScore?: SortOrderInput | SortOrder
    sessionType?: SortOrder
    projectId?: SortOrderInput | SortOrder
    tags?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    toolMetrics?: ToolMetricOrderByRelationAggregateInput
  }

  export type MetricsSessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MetricsSessionWhereInput | MetricsSessionWhereInput[]
    OR?: MetricsSessionWhereInput[]
    NOT?: MetricsSessionWhereInput | MetricsSessionWhereInput[]
    userId?: UuidFilter<"MetricsSession"> | string
    sessionStart?: DateTimeFilter<"MetricsSession"> | Date | string
    sessionEnd?: DateTimeNullableFilter<"MetricsSession"> | Date | string | null
    totalDurationMs?: BigIntNullableFilter<"MetricsSession"> | bigint | number | null
    toolsUsed?: JsonNullableFilter<"MetricsSession">
    productivityScore?: IntNullableFilter<"MetricsSession"> | number | null
    sessionType?: StringFilter<"MetricsSession"> | string
    projectId?: StringNullableFilter<"MetricsSession"> | string | null
    tags?: JsonFilter<"MetricsSession">
    interruptionsCount?: IntFilter<"MetricsSession"> | number
    focusTimeMs?: BigIntFilter<"MetricsSession"> | bigint | number
    description?: StringNullableFilter<"MetricsSession"> | string | null
    createdAt?: DateTimeFilter<"MetricsSession"> | Date | string
    updatedAt?: DateTimeFilter<"MetricsSession"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    toolMetrics?: ToolMetricListRelationFilter
  }, "id">

  export type MetricsSessionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    sessionStart?: SortOrder
    sessionEnd?: SortOrderInput | SortOrder
    totalDurationMs?: SortOrderInput | SortOrder
    toolsUsed?: SortOrderInput | SortOrder
    productivityScore?: SortOrderInput | SortOrder
    sessionType?: SortOrder
    projectId?: SortOrderInput | SortOrder
    tags?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MetricsSessionCountOrderByAggregateInput
    _avg?: MetricsSessionAvgOrderByAggregateInput
    _max?: MetricsSessionMaxOrderByAggregateInput
    _min?: MetricsSessionMinOrderByAggregateInput
    _sum?: MetricsSessionSumOrderByAggregateInput
  }

  export type MetricsSessionScalarWhereWithAggregatesInput = {
    AND?: MetricsSessionScalarWhereWithAggregatesInput | MetricsSessionScalarWhereWithAggregatesInput[]
    OR?: MetricsSessionScalarWhereWithAggregatesInput[]
    NOT?: MetricsSessionScalarWhereWithAggregatesInput | MetricsSessionScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"MetricsSession"> | string
    userId?: UuidWithAggregatesFilter<"MetricsSession"> | string
    sessionStart?: DateTimeWithAggregatesFilter<"MetricsSession"> | Date | string
    sessionEnd?: DateTimeNullableWithAggregatesFilter<"MetricsSession"> | Date | string | null
    totalDurationMs?: BigIntNullableWithAggregatesFilter<"MetricsSession"> | bigint | number | null
    toolsUsed?: JsonNullableWithAggregatesFilter<"MetricsSession">
    productivityScore?: IntNullableWithAggregatesFilter<"MetricsSession"> | number | null
    sessionType?: StringWithAggregatesFilter<"MetricsSession"> | string
    projectId?: StringNullableWithAggregatesFilter<"MetricsSession"> | string | null
    tags?: JsonWithAggregatesFilter<"MetricsSession">
    interruptionsCount?: IntWithAggregatesFilter<"MetricsSession"> | number
    focusTimeMs?: BigIntWithAggregatesFilter<"MetricsSession"> | bigint | number
    description?: StringNullableWithAggregatesFilter<"MetricsSession"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"MetricsSession"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MetricsSession"> | Date | string
  }

  export type ToolMetricWhereInput = {
    AND?: ToolMetricWhereInput | ToolMetricWhereInput[]
    OR?: ToolMetricWhereInput[]
    NOT?: ToolMetricWhereInput | ToolMetricWhereInput[]
    id?: UuidFilter<"ToolMetric"> | string
    sessionId?: UuidFilter<"ToolMetric"> | string
    toolName?: StringFilter<"ToolMetric"> | string
    toolCategory?: StringNullableFilter<"ToolMetric"> | string | null
    executionCount?: IntFilter<"ToolMetric"> | number
    totalDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    averageDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    successRate?: DecimalFilter<"ToolMetric"> | Decimal | DecimalJsLike | number | string
    errorCount?: IntFilter<"ToolMetric"> | number
    memoryUsageMb?: IntNullableFilter<"ToolMetric"> | number | null
    cpuTimeMs?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    parameters?: JsonNullableFilter<"ToolMetric">
    outputSizeBytes?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    commandLine?: StringNullableFilter<"ToolMetric"> | string | null
    workingDirectory?: StringNullableFilter<"ToolMetric"> | string | null
    createdAt?: DateTimeFilter<"ToolMetric"> | Date | string
    session?: XOR<MetricsSessionRelationFilter, MetricsSessionWhereInput>
  }

  export type ToolMetricOrderByWithRelationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    toolName?: SortOrder
    toolCategory?: SortOrderInput | SortOrder
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrderInput | SortOrder
    cpuTimeMs?: SortOrderInput | SortOrder
    parameters?: SortOrderInput | SortOrder
    outputSizeBytes?: SortOrderInput | SortOrder
    commandLine?: SortOrderInput | SortOrder
    workingDirectory?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    session?: MetricsSessionOrderByWithRelationInput
  }

  export type ToolMetricWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ToolMetricWhereInput | ToolMetricWhereInput[]
    OR?: ToolMetricWhereInput[]
    NOT?: ToolMetricWhereInput | ToolMetricWhereInput[]
    sessionId?: UuidFilter<"ToolMetric"> | string
    toolName?: StringFilter<"ToolMetric"> | string
    toolCategory?: StringNullableFilter<"ToolMetric"> | string | null
    executionCount?: IntFilter<"ToolMetric"> | number
    totalDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    averageDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    successRate?: DecimalFilter<"ToolMetric"> | Decimal | DecimalJsLike | number | string
    errorCount?: IntFilter<"ToolMetric"> | number
    memoryUsageMb?: IntNullableFilter<"ToolMetric"> | number | null
    cpuTimeMs?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    parameters?: JsonNullableFilter<"ToolMetric">
    outputSizeBytes?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    commandLine?: StringNullableFilter<"ToolMetric"> | string | null
    workingDirectory?: StringNullableFilter<"ToolMetric"> | string | null
    createdAt?: DateTimeFilter<"ToolMetric"> | Date | string
    session?: XOR<MetricsSessionRelationFilter, MetricsSessionWhereInput>
  }, "id">

  export type ToolMetricOrderByWithAggregationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    toolName?: SortOrder
    toolCategory?: SortOrderInput | SortOrder
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrderInput | SortOrder
    cpuTimeMs?: SortOrderInput | SortOrder
    parameters?: SortOrderInput | SortOrder
    outputSizeBytes?: SortOrderInput | SortOrder
    commandLine?: SortOrderInput | SortOrder
    workingDirectory?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: ToolMetricCountOrderByAggregateInput
    _avg?: ToolMetricAvgOrderByAggregateInput
    _max?: ToolMetricMaxOrderByAggregateInput
    _min?: ToolMetricMinOrderByAggregateInput
    _sum?: ToolMetricSumOrderByAggregateInput
  }

  export type ToolMetricScalarWhereWithAggregatesInput = {
    AND?: ToolMetricScalarWhereWithAggregatesInput | ToolMetricScalarWhereWithAggregatesInput[]
    OR?: ToolMetricScalarWhereWithAggregatesInput[]
    NOT?: ToolMetricScalarWhereWithAggregatesInput | ToolMetricScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"ToolMetric"> | string
    sessionId?: UuidWithAggregatesFilter<"ToolMetric"> | string
    toolName?: StringWithAggregatesFilter<"ToolMetric"> | string
    toolCategory?: StringNullableWithAggregatesFilter<"ToolMetric"> | string | null
    executionCount?: IntWithAggregatesFilter<"ToolMetric"> | number
    totalDurationMs?: BigIntWithAggregatesFilter<"ToolMetric"> | bigint | number
    averageDurationMs?: BigIntWithAggregatesFilter<"ToolMetric"> | bigint | number
    successRate?: DecimalWithAggregatesFilter<"ToolMetric"> | Decimal | DecimalJsLike | number | string
    errorCount?: IntWithAggregatesFilter<"ToolMetric"> | number
    memoryUsageMb?: IntNullableWithAggregatesFilter<"ToolMetric"> | number | null
    cpuTimeMs?: BigIntNullableWithAggregatesFilter<"ToolMetric"> | bigint | number | null
    parameters?: JsonNullableWithAggregatesFilter<"ToolMetric">
    outputSizeBytes?: BigIntNullableWithAggregatesFilter<"ToolMetric"> | bigint | number | null
    commandLine?: StringNullableWithAggregatesFilter<"ToolMetric"> | string | null
    workingDirectory?: StringNullableWithAggregatesFilter<"ToolMetric"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ToolMetric"> | Date | string
  }

  export type DashboardConfigWhereInput = {
    AND?: DashboardConfigWhereInput | DashboardConfigWhereInput[]
    OR?: DashboardConfigWhereInput[]
    NOT?: DashboardConfigWhereInput | DashboardConfigWhereInput[]
    id?: UuidFilter<"DashboardConfig"> | string
    userId?: UuidFilter<"DashboardConfig"> | string
    dashboardName?: StringFilter<"DashboardConfig"> | string
    description?: StringNullableFilter<"DashboardConfig"> | string | null
    widgetLayout?: JsonFilter<"DashboardConfig">
    isDefault?: BoolFilter<"DashboardConfig"> | boolean
    isPublic?: BoolFilter<"DashboardConfig"> | boolean
    refreshIntervalSeconds?: IntFilter<"DashboardConfig"> | number
    sharedWithRoles?: JsonFilter<"DashboardConfig">
    version?: IntFilter<"DashboardConfig"> | number
    createdAt?: DateTimeFilter<"DashboardConfig"> | Date | string
    updatedAt?: DateTimeFilter<"DashboardConfig"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type DashboardConfigOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    dashboardName?: SortOrder
    description?: SortOrderInput | SortOrder
    widgetLayout?: SortOrder
    isDefault?: SortOrder
    isPublic?: SortOrder
    refreshIntervalSeconds?: SortOrder
    sharedWithRoles?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type DashboardConfigWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    unique_default_dashboard?: DashboardConfigUnique_default_dashboardCompoundUniqueInput
    AND?: DashboardConfigWhereInput | DashboardConfigWhereInput[]
    OR?: DashboardConfigWhereInput[]
    NOT?: DashboardConfigWhereInput | DashboardConfigWhereInput[]
    userId?: UuidFilter<"DashboardConfig"> | string
    dashboardName?: StringFilter<"DashboardConfig"> | string
    description?: StringNullableFilter<"DashboardConfig"> | string | null
    widgetLayout?: JsonFilter<"DashboardConfig">
    isDefault?: BoolFilter<"DashboardConfig"> | boolean
    isPublic?: BoolFilter<"DashboardConfig"> | boolean
    refreshIntervalSeconds?: IntFilter<"DashboardConfig"> | number
    sharedWithRoles?: JsonFilter<"DashboardConfig">
    version?: IntFilter<"DashboardConfig"> | number
    createdAt?: DateTimeFilter<"DashboardConfig"> | Date | string
    updatedAt?: DateTimeFilter<"DashboardConfig"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
  }, "id" | "unique_default_dashboard">

  export type DashboardConfigOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    dashboardName?: SortOrder
    description?: SortOrderInput | SortOrder
    widgetLayout?: SortOrder
    isDefault?: SortOrder
    isPublic?: SortOrder
    refreshIntervalSeconds?: SortOrder
    sharedWithRoles?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: DashboardConfigCountOrderByAggregateInput
    _avg?: DashboardConfigAvgOrderByAggregateInput
    _max?: DashboardConfigMaxOrderByAggregateInput
    _min?: DashboardConfigMinOrderByAggregateInput
    _sum?: DashboardConfigSumOrderByAggregateInput
  }

  export type DashboardConfigScalarWhereWithAggregatesInput = {
    AND?: DashboardConfigScalarWhereWithAggregatesInput | DashboardConfigScalarWhereWithAggregatesInput[]
    OR?: DashboardConfigScalarWhereWithAggregatesInput[]
    NOT?: DashboardConfigScalarWhereWithAggregatesInput | DashboardConfigScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"DashboardConfig"> | string
    userId?: UuidWithAggregatesFilter<"DashboardConfig"> | string
    dashboardName?: StringWithAggregatesFilter<"DashboardConfig"> | string
    description?: StringNullableWithAggregatesFilter<"DashboardConfig"> | string | null
    widgetLayout?: JsonWithAggregatesFilter<"DashboardConfig">
    isDefault?: BoolWithAggregatesFilter<"DashboardConfig"> | boolean
    isPublic?: BoolWithAggregatesFilter<"DashboardConfig"> | boolean
    refreshIntervalSeconds?: IntWithAggregatesFilter<"DashboardConfig"> | number
    sharedWithRoles?: JsonWithAggregatesFilter<"DashboardConfig">
    version?: IntWithAggregatesFilter<"DashboardConfig"> | number
    createdAt?: DateTimeWithAggregatesFilter<"DashboardConfig"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"DashboardConfig"> | Date | string
  }

  export type ActivityDataWhereInput = {
    AND?: ActivityDataWhereInput | ActivityDataWhereInput[]
    OR?: ActivityDataWhereInput[]
    NOT?: ActivityDataWhereInput | ActivityDataWhereInput[]
    id?: UuidFilter<"ActivityData"> | string
    userId?: UuidFilter<"ActivityData"> | string
    actionName?: StringFilter<"ActivityData"> | string
    actionDescription?: StringFilter<"ActivityData"> | string
    targetName?: StringFilter<"ActivityData"> | string
    targetType?: StringFilter<"ActivityData"> | string
    status?: StringFilter<"ActivityData"> | string
    priority?: IntFilter<"ActivityData"> | number
    isAutomated?: BoolFilter<"ActivityData"> | boolean
    timestamp?: DateTimeFilter<"ActivityData"> | Date | string
    duration?: IntNullableFilter<"ActivityData"> | number | null
    completedAt?: DateTimeNullableFilter<"ActivityData"> | Date | string | null
    metadata?: JsonNullableFilter<"ActivityData">
    tags?: JsonFilter<"ActivityData">
    projectId?: StringNullableFilter<"ActivityData"> | string | null
    errorMessage?: StringNullableFilter<"ActivityData"> | string | null
    errorCode?: StringNullableFilter<"ActivityData"> | string | null
    createdAt?: DateTimeFilter<"ActivityData"> | Date | string
    updatedAt?: DateTimeFilter<"ActivityData"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type ActivityDataOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    actionName?: SortOrder
    actionDescription?: SortOrder
    targetName?: SortOrder
    targetType?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    isAutomated?: SortOrder
    timestamp?: SortOrder
    duration?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    tags?: SortOrder
    projectId?: SortOrderInput | SortOrder
    errorMessage?: SortOrderInput | SortOrder
    errorCode?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type ActivityDataWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ActivityDataWhereInput | ActivityDataWhereInput[]
    OR?: ActivityDataWhereInput[]
    NOT?: ActivityDataWhereInput | ActivityDataWhereInput[]
    userId?: UuidFilter<"ActivityData"> | string
    actionName?: StringFilter<"ActivityData"> | string
    actionDescription?: StringFilter<"ActivityData"> | string
    targetName?: StringFilter<"ActivityData"> | string
    targetType?: StringFilter<"ActivityData"> | string
    status?: StringFilter<"ActivityData"> | string
    priority?: IntFilter<"ActivityData"> | number
    isAutomated?: BoolFilter<"ActivityData"> | boolean
    timestamp?: DateTimeFilter<"ActivityData"> | Date | string
    duration?: IntNullableFilter<"ActivityData"> | number | null
    completedAt?: DateTimeNullableFilter<"ActivityData"> | Date | string | null
    metadata?: JsonNullableFilter<"ActivityData">
    tags?: JsonFilter<"ActivityData">
    projectId?: StringNullableFilter<"ActivityData"> | string | null
    errorMessage?: StringNullableFilter<"ActivityData"> | string | null
    errorCode?: StringNullableFilter<"ActivityData"> | string | null
    createdAt?: DateTimeFilter<"ActivityData"> | Date | string
    updatedAt?: DateTimeFilter<"ActivityData"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
  }, "id">

  export type ActivityDataOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    actionName?: SortOrder
    actionDescription?: SortOrder
    targetName?: SortOrder
    targetType?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    isAutomated?: SortOrder
    timestamp?: SortOrder
    duration?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    tags?: SortOrder
    projectId?: SortOrderInput | SortOrder
    errorMessage?: SortOrderInput | SortOrder
    errorCode?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ActivityDataCountOrderByAggregateInput
    _avg?: ActivityDataAvgOrderByAggregateInput
    _max?: ActivityDataMaxOrderByAggregateInput
    _min?: ActivityDataMinOrderByAggregateInput
    _sum?: ActivityDataSumOrderByAggregateInput
  }

  export type ActivityDataScalarWhereWithAggregatesInput = {
    AND?: ActivityDataScalarWhereWithAggregatesInput | ActivityDataScalarWhereWithAggregatesInput[]
    OR?: ActivityDataScalarWhereWithAggregatesInput[]
    NOT?: ActivityDataScalarWhereWithAggregatesInput | ActivityDataScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"ActivityData"> | string
    userId?: UuidWithAggregatesFilter<"ActivityData"> | string
    actionName?: StringWithAggregatesFilter<"ActivityData"> | string
    actionDescription?: StringWithAggregatesFilter<"ActivityData"> | string
    targetName?: StringWithAggregatesFilter<"ActivityData"> | string
    targetType?: StringWithAggregatesFilter<"ActivityData"> | string
    status?: StringWithAggregatesFilter<"ActivityData"> | string
    priority?: IntWithAggregatesFilter<"ActivityData"> | number
    isAutomated?: BoolWithAggregatesFilter<"ActivityData"> | boolean
    timestamp?: DateTimeWithAggregatesFilter<"ActivityData"> | Date | string
    duration?: IntNullableWithAggregatesFilter<"ActivityData"> | number | null
    completedAt?: DateTimeNullableWithAggregatesFilter<"ActivityData"> | Date | string | null
    metadata?: JsonNullableWithAggregatesFilter<"ActivityData">
    tags?: JsonWithAggregatesFilter<"ActivityData">
    projectId?: StringNullableWithAggregatesFilter<"ActivityData"> | string | null
    errorMessage?: StringNullableWithAggregatesFilter<"ActivityData"> | string | null
    errorCode?: StringNullableWithAggregatesFilter<"ActivityData"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ActivityData"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ActivityData"> | Date | string
  }

  export type TenantCreateInput = {
    id?: string
    name: string
    domain: string
    schemaName: string
    subscriptionPlan?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isActive?: boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: string | null
    billingEmail?: string | null
    dataRegion?: string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantUncheckedCreateInput = {
    id?: string
    name: string
    domain: string
    schemaName: string
    subscriptionPlan?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isActive?: boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: string | null
    billingEmail?: string | null
    dataRegion?: string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    schemaName?: StringFieldUpdateOperationsInput | string
    subscriptionPlan?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: NullableStringFieldUpdateOperationsInput | string | null
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    dataRegion?: StringFieldUpdateOperationsInput | string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    schemaName?: StringFieldUpdateOperationsInput | string
    subscriptionPlan?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: NullableStringFieldUpdateOperationsInput | string | null
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    dataRegion?: StringFieldUpdateOperationsInput | string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantCreateManyInput = {
    id?: string
    name: string
    domain: string
    schemaName: string
    subscriptionPlan?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isActive?: boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: string | null
    billingEmail?: string | null
    dataRegion?: string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    schemaName?: StringFieldUpdateOperationsInput | string
    subscriptionPlan?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: NullableStringFieldUpdateOperationsInput | string | null
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    dataRegion?: StringFieldUpdateOperationsInput | string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type TenantUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: StringFieldUpdateOperationsInput | string
    schemaName?: StringFieldUpdateOperationsInput | string
    subscriptionPlan?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    metadata?: JsonNullValueInput | InputJsonValue
    adminEmail?: NullableStringFieldUpdateOperationsInput | string | null
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    dataRegion?: StringFieldUpdateOperationsInput | string
    complianceSettings?: JsonNullValueInput | InputJsonValue
  }

  export type UserCreateInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionCreateNestedManyWithoutUserInput
    dashboardConfigs?: DashboardConfigCreateNestedManyWithoutUserInput
    activities?: ActivityDataCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionUncheckedCreateNestedManyWithoutUserInput
    dashboardConfigs?: DashboardConfigUncheckedCreateNestedManyWithoutUserInput
    activities?: ActivityDataUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUpdateManyWithoutUserNestedInput
    dashboardConfigs?: DashboardConfigUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUncheckedUpdateManyWithoutUserNestedInput
    dashboardConfigs?: DashboardConfigUncheckedUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MetricsSessionCreateInput = {
    id?: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMetricsSessionsInput
    toolMetrics?: ToolMetricCreateNestedManyWithoutSessionInput
  }

  export type MetricsSessionUncheckedCreateInput = {
    id?: string
    userId: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    toolMetrics?: ToolMetricUncheckedCreateNestedManyWithoutSessionInput
  }

  export type MetricsSessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMetricsSessionsNestedInput
    toolMetrics?: ToolMetricUpdateManyWithoutSessionNestedInput
  }

  export type MetricsSessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    toolMetrics?: ToolMetricUncheckedUpdateManyWithoutSessionNestedInput
  }

  export type MetricsSessionCreateManyInput = {
    id?: string
    userId: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MetricsSessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MetricsSessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricCreateInput = {
    id?: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
    session: MetricsSessionCreateNestedOneWithoutToolMetricsInput
  }

  export type ToolMetricUncheckedCreateInput = {
    id?: string
    sessionId: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
  }

  export type ToolMetricUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    session?: MetricsSessionUpdateOneRequiredWithoutToolMetricsNestedInput
  }

  export type ToolMetricUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricCreateManyInput = {
    id?: string
    sessionId: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
  }

  export type ToolMetricUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigCreateInput = {
    id?: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutDashboardConfigsInput
  }

  export type DashboardConfigUncheckedCreateInput = {
    id?: string
    userId: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DashboardConfigUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutDashboardConfigsNestedInput
  }

  export type DashboardConfigUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigCreateManyInput = {
    id?: string
    userId: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DashboardConfigUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataCreateInput = {
    id?: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutActivitiesInput
  }

  export type ActivityDataUncheckedCreateInput = {
    id?: string
    userId: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ActivityDataUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutActivitiesNestedInput
  }

  export type ActivityDataUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataCreateManyInput = {
    id?: string
    userId: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ActivityDataUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }
  export type JsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TenantCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    schemaName?: SortOrder
    subscriptionPlan?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isActive?: SortOrder
    metadata?: SortOrder
    adminEmail?: SortOrder
    billingEmail?: SortOrder
    dataRegion?: SortOrder
    complianceSettings?: SortOrder
  }

  export type TenantMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    schemaName?: SortOrder
    subscriptionPlan?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isActive?: SortOrder
    adminEmail?: SortOrder
    billingEmail?: SortOrder
    dataRegion?: SortOrder
  }

  export type TenantMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    schemaName?: SortOrder
    subscriptionPlan?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isActive?: SortOrder
    adminEmail?: SortOrder
    billingEmail?: SortOrder
    dataRegion?: SortOrder
  }

  export type UuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type MetricsSessionListRelationFilter = {
    every?: MetricsSessionWhereInput
    some?: MetricsSessionWhereInput
    none?: MetricsSessionWhereInput
  }

  export type DashboardConfigListRelationFilter = {
    every?: DashboardConfigWhereInput
    some?: DashboardConfigWhereInput
    none?: DashboardConfigWhereInput
  }

  export type ActivityDataListRelationFilter = {
    every?: ActivityDataWhereInput
    some?: ActivityDataWhereInput
    none?: ActivityDataWhereInput
  }

  export type MetricsSessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DashboardConfigOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ActivityDataOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    role?: SortOrder
    password?: SortOrder
    ssoProvider?: SortOrder
    ssoUserId?: SortOrder
    lastLogin?: SortOrder
    loginCount?: SortOrder
    timezone?: SortOrder
    preferences?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    loginCount?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    role?: SortOrder
    password?: SortOrder
    ssoProvider?: SortOrder
    ssoUserId?: SortOrder
    lastLogin?: SortOrder
    loginCount?: SortOrder
    timezone?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    role?: SortOrder
    password?: SortOrder
    ssoProvider?: SortOrder
    ssoUserId?: SortOrder
    lastLogin?: SortOrder
    loginCount?: SortOrder
    timezone?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    loginCount?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type BigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }
  export type JsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type UserRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type ToolMetricListRelationFilter = {
    every?: ToolMetricWhereInput
    some?: ToolMetricWhereInput
    none?: ToolMetricWhereInput
  }

  export type ToolMetricOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MetricsSessionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sessionStart?: SortOrder
    sessionEnd?: SortOrder
    totalDurationMs?: SortOrder
    toolsUsed?: SortOrder
    productivityScore?: SortOrder
    sessionType?: SortOrder
    projectId?: SortOrder
    tags?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MetricsSessionAvgOrderByAggregateInput = {
    totalDurationMs?: SortOrder
    productivityScore?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
  }

  export type MetricsSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sessionStart?: SortOrder
    sessionEnd?: SortOrder
    totalDurationMs?: SortOrder
    productivityScore?: SortOrder
    sessionType?: SortOrder
    projectId?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MetricsSessionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sessionStart?: SortOrder
    sessionEnd?: SortOrder
    totalDurationMs?: SortOrder
    productivityScore?: SortOrder
    sessionType?: SortOrder
    projectId?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MetricsSessionSumOrderByAggregateInput = {
    totalDurationMs?: SortOrder
    productivityScore?: SortOrder
    interruptionsCount?: SortOrder
    focusTimeMs?: SortOrder
  }

  export type BigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type MetricsSessionRelationFilter = {
    is?: MetricsSessionWhereInput
    isNot?: MetricsSessionWhereInput
  }

  export type ToolMetricCountOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    toolName?: SortOrder
    toolCategory?: SortOrder
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrder
    cpuTimeMs?: SortOrder
    parameters?: SortOrder
    outputSizeBytes?: SortOrder
    commandLine?: SortOrder
    workingDirectory?: SortOrder
    createdAt?: SortOrder
  }

  export type ToolMetricAvgOrderByAggregateInput = {
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrder
    cpuTimeMs?: SortOrder
    outputSizeBytes?: SortOrder
  }

  export type ToolMetricMaxOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    toolName?: SortOrder
    toolCategory?: SortOrder
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrder
    cpuTimeMs?: SortOrder
    outputSizeBytes?: SortOrder
    commandLine?: SortOrder
    workingDirectory?: SortOrder
    createdAt?: SortOrder
  }

  export type ToolMetricMinOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    toolName?: SortOrder
    toolCategory?: SortOrder
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrder
    cpuTimeMs?: SortOrder
    outputSizeBytes?: SortOrder
    commandLine?: SortOrder
    workingDirectory?: SortOrder
    createdAt?: SortOrder
  }

  export type ToolMetricSumOrderByAggregateInput = {
    executionCount?: SortOrder
    totalDurationMs?: SortOrder
    averageDurationMs?: SortOrder
    successRate?: SortOrder
    errorCount?: SortOrder
    memoryUsageMb?: SortOrder
    cpuTimeMs?: SortOrder
    outputSizeBytes?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type DashboardConfigUnique_default_dashboardCompoundUniqueInput = {
    userId: string
    isDefault: boolean
  }

  export type DashboardConfigCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    dashboardName?: SortOrder
    description?: SortOrder
    widgetLayout?: SortOrder
    isDefault?: SortOrder
    isPublic?: SortOrder
    refreshIntervalSeconds?: SortOrder
    sharedWithRoles?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DashboardConfigAvgOrderByAggregateInput = {
    refreshIntervalSeconds?: SortOrder
    version?: SortOrder
  }

  export type DashboardConfigMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    dashboardName?: SortOrder
    description?: SortOrder
    isDefault?: SortOrder
    isPublic?: SortOrder
    refreshIntervalSeconds?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DashboardConfigMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    dashboardName?: SortOrder
    description?: SortOrder
    isDefault?: SortOrder
    isPublic?: SortOrder
    refreshIntervalSeconds?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DashboardConfigSumOrderByAggregateInput = {
    refreshIntervalSeconds?: SortOrder
    version?: SortOrder
  }

  export type ActivityDataCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    actionName?: SortOrder
    actionDescription?: SortOrder
    targetName?: SortOrder
    targetType?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    isAutomated?: SortOrder
    timestamp?: SortOrder
    duration?: SortOrder
    completedAt?: SortOrder
    metadata?: SortOrder
    tags?: SortOrder
    projectId?: SortOrder
    errorMessage?: SortOrder
    errorCode?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ActivityDataAvgOrderByAggregateInput = {
    priority?: SortOrder
    duration?: SortOrder
  }

  export type ActivityDataMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    actionName?: SortOrder
    actionDescription?: SortOrder
    targetName?: SortOrder
    targetType?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    isAutomated?: SortOrder
    timestamp?: SortOrder
    duration?: SortOrder
    completedAt?: SortOrder
    projectId?: SortOrder
    errorMessage?: SortOrder
    errorCode?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ActivityDataMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    actionName?: SortOrder
    actionDescription?: SortOrder
    targetName?: SortOrder
    targetType?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    isAutomated?: SortOrder
    timestamp?: SortOrder
    duration?: SortOrder
    completedAt?: SortOrder
    projectId?: SortOrder
    errorMessage?: SortOrder
    errorCode?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ActivityDataSumOrderByAggregateInput = {
    priority?: SortOrder
    duration?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type MetricsSessionCreateNestedManyWithoutUserInput = {
    create?: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput> | MetricsSessionCreateWithoutUserInput[] | MetricsSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutUserInput | MetricsSessionCreateOrConnectWithoutUserInput[]
    createMany?: MetricsSessionCreateManyUserInputEnvelope
    connect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
  }

  export type DashboardConfigCreateNestedManyWithoutUserInput = {
    create?: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput> | DashboardConfigCreateWithoutUserInput[] | DashboardConfigUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DashboardConfigCreateOrConnectWithoutUserInput | DashboardConfigCreateOrConnectWithoutUserInput[]
    createMany?: DashboardConfigCreateManyUserInputEnvelope
    connect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
  }

  export type ActivityDataCreateNestedManyWithoutUserInput = {
    create?: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput> | ActivityDataCreateWithoutUserInput[] | ActivityDataUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ActivityDataCreateOrConnectWithoutUserInput | ActivityDataCreateOrConnectWithoutUserInput[]
    createMany?: ActivityDataCreateManyUserInputEnvelope
    connect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
  }

  export type MetricsSessionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput> | MetricsSessionCreateWithoutUserInput[] | MetricsSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutUserInput | MetricsSessionCreateOrConnectWithoutUserInput[]
    createMany?: MetricsSessionCreateManyUserInputEnvelope
    connect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
  }

  export type DashboardConfigUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput> | DashboardConfigCreateWithoutUserInput[] | DashboardConfigUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DashboardConfigCreateOrConnectWithoutUserInput | DashboardConfigCreateOrConnectWithoutUserInput[]
    createMany?: DashboardConfigCreateManyUserInputEnvelope
    connect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
  }

  export type ActivityDataUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput> | ActivityDataCreateWithoutUserInput[] | ActivityDataUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ActivityDataCreateOrConnectWithoutUserInput | ActivityDataCreateOrConnectWithoutUserInput[]
    createMany?: ActivityDataCreateManyUserInputEnvelope
    connect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type MetricsSessionUpdateManyWithoutUserNestedInput = {
    create?: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput> | MetricsSessionCreateWithoutUserInput[] | MetricsSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutUserInput | MetricsSessionCreateOrConnectWithoutUserInput[]
    upsert?: MetricsSessionUpsertWithWhereUniqueWithoutUserInput | MetricsSessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MetricsSessionCreateManyUserInputEnvelope
    set?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    disconnect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    delete?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    connect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    update?: MetricsSessionUpdateWithWhereUniqueWithoutUserInput | MetricsSessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MetricsSessionUpdateManyWithWhereWithoutUserInput | MetricsSessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MetricsSessionScalarWhereInput | MetricsSessionScalarWhereInput[]
  }

  export type DashboardConfigUpdateManyWithoutUserNestedInput = {
    create?: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput> | DashboardConfigCreateWithoutUserInput[] | DashboardConfigUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DashboardConfigCreateOrConnectWithoutUserInput | DashboardConfigCreateOrConnectWithoutUserInput[]
    upsert?: DashboardConfigUpsertWithWhereUniqueWithoutUserInput | DashboardConfigUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DashboardConfigCreateManyUserInputEnvelope
    set?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    disconnect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    delete?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    connect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    update?: DashboardConfigUpdateWithWhereUniqueWithoutUserInput | DashboardConfigUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DashboardConfigUpdateManyWithWhereWithoutUserInput | DashboardConfigUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DashboardConfigScalarWhereInput | DashboardConfigScalarWhereInput[]
  }

  export type ActivityDataUpdateManyWithoutUserNestedInput = {
    create?: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput> | ActivityDataCreateWithoutUserInput[] | ActivityDataUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ActivityDataCreateOrConnectWithoutUserInput | ActivityDataCreateOrConnectWithoutUserInput[]
    upsert?: ActivityDataUpsertWithWhereUniqueWithoutUserInput | ActivityDataUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ActivityDataCreateManyUserInputEnvelope
    set?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    disconnect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    delete?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    connect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    update?: ActivityDataUpdateWithWhereUniqueWithoutUserInput | ActivityDataUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ActivityDataUpdateManyWithWhereWithoutUserInput | ActivityDataUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ActivityDataScalarWhereInput | ActivityDataScalarWhereInput[]
  }

  export type MetricsSessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput> | MetricsSessionCreateWithoutUserInput[] | MetricsSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutUserInput | MetricsSessionCreateOrConnectWithoutUserInput[]
    upsert?: MetricsSessionUpsertWithWhereUniqueWithoutUserInput | MetricsSessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MetricsSessionCreateManyUserInputEnvelope
    set?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    disconnect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    delete?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    connect?: MetricsSessionWhereUniqueInput | MetricsSessionWhereUniqueInput[]
    update?: MetricsSessionUpdateWithWhereUniqueWithoutUserInput | MetricsSessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MetricsSessionUpdateManyWithWhereWithoutUserInput | MetricsSessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MetricsSessionScalarWhereInput | MetricsSessionScalarWhereInput[]
  }

  export type DashboardConfigUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput> | DashboardConfigCreateWithoutUserInput[] | DashboardConfigUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DashboardConfigCreateOrConnectWithoutUserInput | DashboardConfigCreateOrConnectWithoutUserInput[]
    upsert?: DashboardConfigUpsertWithWhereUniqueWithoutUserInput | DashboardConfigUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DashboardConfigCreateManyUserInputEnvelope
    set?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    disconnect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    delete?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    connect?: DashboardConfigWhereUniqueInput | DashboardConfigWhereUniqueInput[]
    update?: DashboardConfigUpdateWithWhereUniqueWithoutUserInput | DashboardConfigUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DashboardConfigUpdateManyWithWhereWithoutUserInput | DashboardConfigUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DashboardConfigScalarWhereInput | DashboardConfigScalarWhereInput[]
  }

  export type ActivityDataUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput> | ActivityDataCreateWithoutUserInput[] | ActivityDataUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ActivityDataCreateOrConnectWithoutUserInput | ActivityDataCreateOrConnectWithoutUserInput[]
    upsert?: ActivityDataUpsertWithWhereUniqueWithoutUserInput | ActivityDataUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ActivityDataCreateManyUserInputEnvelope
    set?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    disconnect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    delete?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    connect?: ActivityDataWhereUniqueInput | ActivityDataWhereUniqueInput[]
    update?: ActivityDataUpdateWithWhereUniqueWithoutUserInput | ActivityDataUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ActivityDataUpdateManyWithWhereWithoutUserInput | ActivityDataUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ActivityDataScalarWhereInput | ActivityDataScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutMetricsSessionsInput = {
    create?: XOR<UserCreateWithoutMetricsSessionsInput, UserUncheckedCreateWithoutMetricsSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMetricsSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type ToolMetricCreateNestedManyWithoutSessionInput = {
    create?: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput> | ToolMetricCreateWithoutSessionInput[] | ToolMetricUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: ToolMetricCreateOrConnectWithoutSessionInput | ToolMetricCreateOrConnectWithoutSessionInput[]
    createMany?: ToolMetricCreateManySessionInputEnvelope
    connect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
  }

  export type ToolMetricUncheckedCreateNestedManyWithoutSessionInput = {
    create?: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput> | ToolMetricCreateWithoutSessionInput[] | ToolMetricUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: ToolMetricCreateOrConnectWithoutSessionInput | ToolMetricCreateOrConnectWithoutSessionInput[]
    createMany?: ToolMetricCreateManySessionInputEnvelope
    connect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
  }

  export type NullableBigIntFieldUpdateOperationsInput = {
    set?: bigint | number | null
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type UserUpdateOneRequiredWithoutMetricsSessionsNestedInput = {
    create?: XOR<UserCreateWithoutMetricsSessionsInput, UserUncheckedCreateWithoutMetricsSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMetricsSessionsInput
    upsert?: UserUpsertWithoutMetricsSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutMetricsSessionsInput, UserUpdateWithoutMetricsSessionsInput>, UserUncheckedUpdateWithoutMetricsSessionsInput>
  }

  export type ToolMetricUpdateManyWithoutSessionNestedInput = {
    create?: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput> | ToolMetricCreateWithoutSessionInput[] | ToolMetricUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: ToolMetricCreateOrConnectWithoutSessionInput | ToolMetricCreateOrConnectWithoutSessionInput[]
    upsert?: ToolMetricUpsertWithWhereUniqueWithoutSessionInput | ToolMetricUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: ToolMetricCreateManySessionInputEnvelope
    set?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    disconnect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    delete?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    connect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    update?: ToolMetricUpdateWithWhereUniqueWithoutSessionInput | ToolMetricUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: ToolMetricUpdateManyWithWhereWithoutSessionInput | ToolMetricUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: ToolMetricScalarWhereInput | ToolMetricScalarWhereInput[]
  }

  export type ToolMetricUncheckedUpdateManyWithoutSessionNestedInput = {
    create?: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput> | ToolMetricCreateWithoutSessionInput[] | ToolMetricUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: ToolMetricCreateOrConnectWithoutSessionInput | ToolMetricCreateOrConnectWithoutSessionInput[]
    upsert?: ToolMetricUpsertWithWhereUniqueWithoutSessionInput | ToolMetricUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: ToolMetricCreateManySessionInputEnvelope
    set?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    disconnect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    delete?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    connect?: ToolMetricWhereUniqueInput | ToolMetricWhereUniqueInput[]
    update?: ToolMetricUpdateWithWhereUniqueWithoutSessionInput | ToolMetricUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: ToolMetricUpdateManyWithWhereWithoutSessionInput | ToolMetricUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: ToolMetricScalarWhereInput | ToolMetricScalarWhereInput[]
  }

  export type MetricsSessionCreateNestedOneWithoutToolMetricsInput = {
    create?: XOR<MetricsSessionCreateWithoutToolMetricsInput, MetricsSessionUncheckedCreateWithoutToolMetricsInput>
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutToolMetricsInput
    connect?: MetricsSessionWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type MetricsSessionUpdateOneRequiredWithoutToolMetricsNestedInput = {
    create?: XOR<MetricsSessionCreateWithoutToolMetricsInput, MetricsSessionUncheckedCreateWithoutToolMetricsInput>
    connectOrCreate?: MetricsSessionCreateOrConnectWithoutToolMetricsInput
    upsert?: MetricsSessionUpsertWithoutToolMetricsInput
    connect?: MetricsSessionWhereUniqueInput
    update?: XOR<XOR<MetricsSessionUpdateToOneWithWhereWithoutToolMetricsInput, MetricsSessionUpdateWithoutToolMetricsInput>, MetricsSessionUncheckedUpdateWithoutToolMetricsInput>
  }

  export type UserCreateNestedOneWithoutDashboardConfigsInput = {
    create?: XOR<UserCreateWithoutDashboardConfigsInput, UserUncheckedCreateWithoutDashboardConfigsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDashboardConfigsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutDashboardConfigsNestedInput = {
    create?: XOR<UserCreateWithoutDashboardConfigsInput, UserUncheckedCreateWithoutDashboardConfigsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDashboardConfigsInput
    upsert?: UserUpsertWithoutDashboardConfigsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutDashboardConfigsInput, UserUpdateWithoutDashboardConfigsInput>, UserUncheckedUpdateWithoutDashboardConfigsInput>
  }

  export type UserCreateNestedOneWithoutActivitiesInput = {
    create?: XOR<UserCreateWithoutActivitiesInput, UserUncheckedCreateWithoutActivitiesInput>
    connectOrCreate?: UserCreateOrConnectWithoutActivitiesInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutActivitiesNestedInput = {
    create?: XOR<UserCreateWithoutActivitiesInput, UserUncheckedCreateWithoutActivitiesInput>
    connectOrCreate?: UserCreateOrConnectWithoutActivitiesInput
    upsert?: UserUpsertWithoutActivitiesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutActivitiesInput, UserUpdateWithoutActivitiesInput>, UserUncheckedUpdateWithoutActivitiesInput>
  }

  export type NestedUuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedUuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedBigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type NestedBigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type MetricsSessionCreateWithoutUserInput = {
    id?: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    toolMetrics?: ToolMetricCreateNestedManyWithoutSessionInput
  }

  export type MetricsSessionUncheckedCreateWithoutUserInput = {
    id?: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    toolMetrics?: ToolMetricUncheckedCreateNestedManyWithoutSessionInput
  }

  export type MetricsSessionCreateOrConnectWithoutUserInput = {
    where: MetricsSessionWhereUniqueInput
    create: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput>
  }

  export type MetricsSessionCreateManyUserInputEnvelope = {
    data: MetricsSessionCreateManyUserInput | MetricsSessionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type DashboardConfigCreateWithoutUserInput = {
    id?: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DashboardConfigUncheckedCreateWithoutUserInput = {
    id?: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DashboardConfigCreateOrConnectWithoutUserInput = {
    where: DashboardConfigWhereUniqueInput
    create: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput>
  }

  export type DashboardConfigCreateManyUserInputEnvelope = {
    data: DashboardConfigCreateManyUserInput | DashboardConfigCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ActivityDataCreateWithoutUserInput = {
    id?: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ActivityDataUncheckedCreateWithoutUserInput = {
    id?: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ActivityDataCreateOrConnectWithoutUserInput = {
    where: ActivityDataWhereUniqueInput
    create: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput>
  }

  export type ActivityDataCreateManyUserInputEnvelope = {
    data: ActivityDataCreateManyUserInput | ActivityDataCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type MetricsSessionUpsertWithWhereUniqueWithoutUserInput = {
    where: MetricsSessionWhereUniqueInput
    update: XOR<MetricsSessionUpdateWithoutUserInput, MetricsSessionUncheckedUpdateWithoutUserInput>
    create: XOR<MetricsSessionCreateWithoutUserInput, MetricsSessionUncheckedCreateWithoutUserInput>
  }

  export type MetricsSessionUpdateWithWhereUniqueWithoutUserInput = {
    where: MetricsSessionWhereUniqueInput
    data: XOR<MetricsSessionUpdateWithoutUserInput, MetricsSessionUncheckedUpdateWithoutUserInput>
  }

  export type MetricsSessionUpdateManyWithWhereWithoutUserInput = {
    where: MetricsSessionScalarWhereInput
    data: XOR<MetricsSessionUpdateManyMutationInput, MetricsSessionUncheckedUpdateManyWithoutUserInput>
  }

  export type MetricsSessionScalarWhereInput = {
    AND?: MetricsSessionScalarWhereInput | MetricsSessionScalarWhereInput[]
    OR?: MetricsSessionScalarWhereInput[]
    NOT?: MetricsSessionScalarWhereInput | MetricsSessionScalarWhereInput[]
    id?: UuidFilter<"MetricsSession"> | string
    userId?: UuidFilter<"MetricsSession"> | string
    sessionStart?: DateTimeFilter<"MetricsSession"> | Date | string
    sessionEnd?: DateTimeNullableFilter<"MetricsSession"> | Date | string | null
    totalDurationMs?: BigIntNullableFilter<"MetricsSession"> | bigint | number | null
    toolsUsed?: JsonNullableFilter<"MetricsSession">
    productivityScore?: IntNullableFilter<"MetricsSession"> | number | null
    sessionType?: StringFilter<"MetricsSession"> | string
    projectId?: StringNullableFilter<"MetricsSession"> | string | null
    tags?: JsonFilter<"MetricsSession">
    interruptionsCount?: IntFilter<"MetricsSession"> | number
    focusTimeMs?: BigIntFilter<"MetricsSession"> | bigint | number
    description?: StringNullableFilter<"MetricsSession"> | string | null
    createdAt?: DateTimeFilter<"MetricsSession"> | Date | string
    updatedAt?: DateTimeFilter<"MetricsSession"> | Date | string
  }

  export type DashboardConfigUpsertWithWhereUniqueWithoutUserInput = {
    where: DashboardConfigWhereUniqueInput
    update: XOR<DashboardConfigUpdateWithoutUserInput, DashboardConfigUncheckedUpdateWithoutUserInput>
    create: XOR<DashboardConfigCreateWithoutUserInput, DashboardConfigUncheckedCreateWithoutUserInput>
  }

  export type DashboardConfigUpdateWithWhereUniqueWithoutUserInput = {
    where: DashboardConfigWhereUniqueInput
    data: XOR<DashboardConfigUpdateWithoutUserInput, DashboardConfigUncheckedUpdateWithoutUserInput>
  }

  export type DashboardConfigUpdateManyWithWhereWithoutUserInput = {
    where: DashboardConfigScalarWhereInput
    data: XOR<DashboardConfigUpdateManyMutationInput, DashboardConfigUncheckedUpdateManyWithoutUserInput>
  }

  export type DashboardConfigScalarWhereInput = {
    AND?: DashboardConfigScalarWhereInput | DashboardConfigScalarWhereInput[]
    OR?: DashboardConfigScalarWhereInput[]
    NOT?: DashboardConfigScalarWhereInput | DashboardConfigScalarWhereInput[]
    id?: UuidFilter<"DashboardConfig"> | string
    userId?: UuidFilter<"DashboardConfig"> | string
    dashboardName?: StringFilter<"DashboardConfig"> | string
    description?: StringNullableFilter<"DashboardConfig"> | string | null
    widgetLayout?: JsonFilter<"DashboardConfig">
    isDefault?: BoolFilter<"DashboardConfig"> | boolean
    isPublic?: BoolFilter<"DashboardConfig"> | boolean
    refreshIntervalSeconds?: IntFilter<"DashboardConfig"> | number
    sharedWithRoles?: JsonFilter<"DashboardConfig">
    version?: IntFilter<"DashboardConfig"> | number
    createdAt?: DateTimeFilter<"DashboardConfig"> | Date | string
    updatedAt?: DateTimeFilter<"DashboardConfig"> | Date | string
  }

  export type ActivityDataUpsertWithWhereUniqueWithoutUserInput = {
    where: ActivityDataWhereUniqueInput
    update: XOR<ActivityDataUpdateWithoutUserInput, ActivityDataUncheckedUpdateWithoutUserInput>
    create: XOR<ActivityDataCreateWithoutUserInput, ActivityDataUncheckedCreateWithoutUserInput>
  }

  export type ActivityDataUpdateWithWhereUniqueWithoutUserInput = {
    where: ActivityDataWhereUniqueInput
    data: XOR<ActivityDataUpdateWithoutUserInput, ActivityDataUncheckedUpdateWithoutUserInput>
  }

  export type ActivityDataUpdateManyWithWhereWithoutUserInput = {
    where: ActivityDataScalarWhereInput
    data: XOR<ActivityDataUpdateManyMutationInput, ActivityDataUncheckedUpdateManyWithoutUserInput>
  }

  export type ActivityDataScalarWhereInput = {
    AND?: ActivityDataScalarWhereInput | ActivityDataScalarWhereInput[]
    OR?: ActivityDataScalarWhereInput[]
    NOT?: ActivityDataScalarWhereInput | ActivityDataScalarWhereInput[]
    id?: UuidFilter<"ActivityData"> | string
    userId?: UuidFilter<"ActivityData"> | string
    actionName?: StringFilter<"ActivityData"> | string
    actionDescription?: StringFilter<"ActivityData"> | string
    targetName?: StringFilter<"ActivityData"> | string
    targetType?: StringFilter<"ActivityData"> | string
    status?: StringFilter<"ActivityData"> | string
    priority?: IntFilter<"ActivityData"> | number
    isAutomated?: BoolFilter<"ActivityData"> | boolean
    timestamp?: DateTimeFilter<"ActivityData"> | Date | string
    duration?: IntNullableFilter<"ActivityData"> | number | null
    completedAt?: DateTimeNullableFilter<"ActivityData"> | Date | string | null
    metadata?: JsonNullableFilter<"ActivityData">
    tags?: JsonFilter<"ActivityData">
    projectId?: StringNullableFilter<"ActivityData"> | string | null
    errorMessage?: StringNullableFilter<"ActivityData"> | string | null
    errorCode?: StringNullableFilter<"ActivityData"> | string | null
    createdAt?: DateTimeFilter<"ActivityData"> | Date | string
    updatedAt?: DateTimeFilter<"ActivityData"> | Date | string
  }

  export type UserCreateWithoutMetricsSessionsInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    dashboardConfigs?: DashboardConfigCreateNestedManyWithoutUserInput
    activities?: ActivityDataCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutMetricsSessionsInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    dashboardConfigs?: DashboardConfigUncheckedCreateNestedManyWithoutUserInput
    activities?: ActivityDataUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutMetricsSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMetricsSessionsInput, UserUncheckedCreateWithoutMetricsSessionsInput>
  }

  export type ToolMetricCreateWithoutSessionInput = {
    id?: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
  }

  export type ToolMetricUncheckedCreateWithoutSessionInput = {
    id?: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
  }

  export type ToolMetricCreateOrConnectWithoutSessionInput = {
    where: ToolMetricWhereUniqueInput
    create: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput>
  }

  export type ToolMetricCreateManySessionInputEnvelope = {
    data: ToolMetricCreateManySessionInput | ToolMetricCreateManySessionInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutMetricsSessionsInput = {
    update: XOR<UserUpdateWithoutMetricsSessionsInput, UserUncheckedUpdateWithoutMetricsSessionsInput>
    create: XOR<UserCreateWithoutMetricsSessionsInput, UserUncheckedCreateWithoutMetricsSessionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutMetricsSessionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutMetricsSessionsInput, UserUncheckedUpdateWithoutMetricsSessionsInput>
  }

  export type UserUpdateWithoutMetricsSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    dashboardConfigs?: DashboardConfigUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutMetricsSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    dashboardConfigs?: DashboardConfigUncheckedUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUncheckedUpdateManyWithoutUserNestedInput
  }

  export type ToolMetricUpsertWithWhereUniqueWithoutSessionInput = {
    where: ToolMetricWhereUniqueInput
    update: XOR<ToolMetricUpdateWithoutSessionInput, ToolMetricUncheckedUpdateWithoutSessionInput>
    create: XOR<ToolMetricCreateWithoutSessionInput, ToolMetricUncheckedCreateWithoutSessionInput>
  }

  export type ToolMetricUpdateWithWhereUniqueWithoutSessionInput = {
    where: ToolMetricWhereUniqueInput
    data: XOR<ToolMetricUpdateWithoutSessionInput, ToolMetricUncheckedUpdateWithoutSessionInput>
  }

  export type ToolMetricUpdateManyWithWhereWithoutSessionInput = {
    where: ToolMetricScalarWhereInput
    data: XOR<ToolMetricUpdateManyMutationInput, ToolMetricUncheckedUpdateManyWithoutSessionInput>
  }

  export type ToolMetricScalarWhereInput = {
    AND?: ToolMetricScalarWhereInput | ToolMetricScalarWhereInput[]
    OR?: ToolMetricScalarWhereInput[]
    NOT?: ToolMetricScalarWhereInput | ToolMetricScalarWhereInput[]
    id?: UuidFilter<"ToolMetric"> | string
    sessionId?: UuidFilter<"ToolMetric"> | string
    toolName?: StringFilter<"ToolMetric"> | string
    toolCategory?: StringNullableFilter<"ToolMetric"> | string | null
    executionCount?: IntFilter<"ToolMetric"> | number
    totalDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    averageDurationMs?: BigIntFilter<"ToolMetric"> | bigint | number
    successRate?: DecimalFilter<"ToolMetric"> | Decimal | DecimalJsLike | number | string
    errorCount?: IntFilter<"ToolMetric"> | number
    memoryUsageMb?: IntNullableFilter<"ToolMetric"> | number | null
    cpuTimeMs?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    parameters?: JsonNullableFilter<"ToolMetric">
    outputSizeBytes?: BigIntNullableFilter<"ToolMetric"> | bigint | number | null
    commandLine?: StringNullableFilter<"ToolMetric"> | string | null
    workingDirectory?: StringNullableFilter<"ToolMetric"> | string | null
    createdAt?: DateTimeFilter<"ToolMetric"> | Date | string
  }

  export type MetricsSessionCreateWithoutToolMetricsInput = {
    id?: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMetricsSessionsInput
  }

  export type MetricsSessionUncheckedCreateWithoutToolMetricsInput = {
    id?: string
    userId: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MetricsSessionCreateOrConnectWithoutToolMetricsInput = {
    where: MetricsSessionWhereUniqueInput
    create: XOR<MetricsSessionCreateWithoutToolMetricsInput, MetricsSessionUncheckedCreateWithoutToolMetricsInput>
  }

  export type MetricsSessionUpsertWithoutToolMetricsInput = {
    update: XOR<MetricsSessionUpdateWithoutToolMetricsInput, MetricsSessionUncheckedUpdateWithoutToolMetricsInput>
    create: XOR<MetricsSessionCreateWithoutToolMetricsInput, MetricsSessionUncheckedCreateWithoutToolMetricsInput>
    where?: MetricsSessionWhereInput
  }

  export type MetricsSessionUpdateToOneWithWhereWithoutToolMetricsInput = {
    where?: MetricsSessionWhereInput
    data: XOR<MetricsSessionUpdateWithoutToolMetricsInput, MetricsSessionUncheckedUpdateWithoutToolMetricsInput>
  }

  export type MetricsSessionUpdateWithoutToolMetricsInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMetricsSessionsNestedInput
  }

  export type MetricsSessionUncheckedUpdateWithoutToolMetricsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateWithoutDashboardConfigsInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionCreateNestedManyWithoutUserInput
    activities?: ActivityDataCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutDashboardConfigsInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionUncheckedCreateNestedManyWithoutUserInput
    activities?: ActivityDataUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutDashboardConfigsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutDashboardConfigsInput, UserUncheckedCreateWithoutDashboardConfigsInput>
  }

  export type UserUpsertWithoutDashboardConfigsInput = {
    update: XOR<UserUpdateWithoutDashboardConfigsInput, UserUncheckedUpdateWithoutDashboardConfigsInput>
    create: XOR<UserCreateWithoutDashboardConfigsInput, UserUncheckedCreateWithoutDashboardConfigsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutDashboardConfigsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutDashboardConfigsInput, UserUncheckedUpdateWithoutDashboardConfigsInput>
  }

  export type UserUpdateWithoutDashboardConfigsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutDashboardConfigsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUncheckedUpdateManyWithoutUserNestedInput
    activities?: ActivityDataUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutActivitiesInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionCreateNestedManyWithoutUserInput
    dashboardConfigs?: DashboardConfigCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutActivitiesInput = {
    id?: string
    email: string
    firstName: string
    lastName: string
    role?: string
    password?: string | null
    ssoProvider?: string | null
    ssoUserId?: string | null
    lastLogin?: Date | string | null
    loginCount?: number
    timezone?: string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    metricsSessions?: MetricsSessionUncheckedCreateNestedManyWithoutUserInput
    dashboardConfigs?: DashboardConfigUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutActivitiesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutActivitiesInput, UserUncheckedCreateWithoutActivitiesInput>
  }

  export type UserUpsertWithoutActivitiesInput = {
    update: XOR<UserUpdateWithoutActivitiesInput, UserUncheckedUpdateWithoutActivitiesInput>
    create: XOR<UserCreateWithoutActivitiesInput, UserUncheckedCreateWithoutActivitiesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutActivitiesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutActivitiesInput, UserUncheckedUpdateWithoutActivitiesInput>
  }

  export type UserUpdateWithoutActivitiesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUpdateManyWithoutUserNestedInput
    dashboardConfigs?: DashboardConfigUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutActivitiesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    ssoProvider?: NullableStringFieldUpdateOperationsInput | string | null
    ssoUserId?: NullableStringFieldUpdateOperationsInput | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    loginCount?: IntFieldUpdateOperationsInput | number
    timezone?: StringFieldUpdateOperationsInput | string
    preferences?: JsonNullValueInput | InputJsonValue
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metricsSessions?: MetricsSessionUncheckedUpdateManyWithoutUserNestedInput
    dashboardConfigs?: DashboardConfigUncheckedUpdateManyWithoutUserNestedInput
  }

  export type MetricsSessionCreateManyUserInput = {
    id?: string
    sessionStart: Date | string
    sessionEnd?: Date | string | null
    totalDurationMs?: bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: number | null
    sessionType?: string
    projectId?: string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: number
    focusTimeMs?: bigint | number
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DashboardConfigCreateManyUserInput = {
    id?: string
    dashboardName: string
    description?: string | null
    widgetLayout: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    isPublic?: boolean
    refreshIntervalSeconds?: number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ActivityDataCreateManyUserInput = {
    id?: string
    actionName: string
    actionDescription: string
    targetName: string
    targetType?: string
    status?: string
    priority?: number
    isAutomated?: boolean
    timestamp?: Date | string
    duration?: number | null
    completedAt?: Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: string | null
    errorMessage?: string | null
    errorCode?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MetricsSessionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    toolMetrics?: ToolMetricUpdateManyWithoutSessionNestedInput
  }

  export type MetricsSessionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    toolMetrics?: ToolMetricUncheckedUpdateManyWithoutSessionNestedInput
  }

  export type MetricsSessionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionStart?: DateTimeFieldUpdateOperationsInput | Date | string
    sessionEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalDurationMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    toolsUsed?: NullableJsonNullValueInput | InputJsonValue
    productivityScore?: NullableIntFieldUpdateOperationsInput | number | null
    sessionType?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    tags?: JsonNullValueInput | InputJsonValue
    interruptionsCount?: IntFieldUpdateOperationsInput | number
    focusTimeMs?: BigIntFieldUpdateOperationsInput | bigint | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DashboardConfigUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    dashboardName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    widgetLayout?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    refreshIntervalSeconds?: IntFieldUpdateOperationsInput | number
    sharedWithRoles?: JsonNullValueInput | InputJsonValue
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityDataUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    actionName?: StringFieldUpdateOperationsInput | string
    actionDescription?: StringFieldUpdateOperationsInput | string
    targetName?: StringFieldUpdateOperationsInput | string
    targetType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    priority?: IntFieldUpdateOperationsInput | number
    isAutomated?: BoolFieldUpdateOperationsInput | boolean
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    tags?: JsonNullValueInput | InputJsonValue
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    errorCode?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricCreateManySessionInput = {
    id?: string
    toolName: string
    toolCategory?: string | null
    executionCount?: number
    totalDurationMs: bigint | number
    averageDurationMs: bigint | number
    successRate: Decimal | DecimalJsLike | number | string
    errorCount?: number
    memoryUsageMb?: number | null
    cpuTimeMs?: bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: bigint | number | null
    commandLine?: string | null
    workingDirectory?: string | null
    createdAt?: Date | string
  }

  export type ToolMetricUpdateWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricUncheckedUpdateWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ToolMetricUncheckedUpdateManyWithoutSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    toolName?: StringFieldUpdateOperationsInput | string
    toolCategory?: NullableStringFieldUpdateOperationsInput | string | null
    executionCount?: IntFieldUpdateOperationsInput | number
    totalDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    averageDurationMs?: BigIntFieldUpdateOperationsInput | bigint | number
    successRate?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorCount?: IntFieldUpdateOperationsInput | number
    memoryUsageMb?: NullableIntFieldUpdateOperationsInput | number | null
    cpuTimeMs?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    parameters?: NullableJsonNullValueInput | InputJsonValue
    outputSizeBytes?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    commandLine?: NullableStringFieldUpdateOperationsInput | string | null
    workingDirectory?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use UserCountOutputTypeDefaultArgs instead
     */
    export type UserCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MetricsSessionCountOutputTypeDefaultArgs instead
     */
    export type MetricsSessionCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MetricsSessionCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use TenantDefaultArgs instead
     */
    export type TenantArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = TenantDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserDefaultArgs instead
     */
    export type UserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MetricsSessionDefaultArgs instead
     */
    export type MetricsSessionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MetricsSessionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ToolMetricDefaultArgs instead
     */
    export type ToolMetricArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ToolMetricDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DashboardConfigDefaultArgs instead
     */
    export type DashboardConfigArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DashboardConfigDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ActivityDataDefaultArgs instead
     */
    export type ActivityDataArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ActivityDataDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}