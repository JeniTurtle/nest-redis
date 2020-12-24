import * as querystring from "querystring";
import schedule from "node-schedule";
import { RedisClient } from "redis";
import { Reflector } from "@nestjs/core";
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  LoggerService,
} from "@nestjs/common";
import {
  ICacheManager,
  TCacheKey,
  TCacheResult,
  ICacheIoResult,
  ICachePromiseOption,
  ICachePromiseIoOption,
  ICacheIntervalOption,
  ICacheIntervalIOOption,
  TCacheIntervalResult,
  CacheConfig,
} from "./cache.interface";
import { RedisClientNoReadyException } from "./cache.exception";
import {
  SERVICE_CACHE_METADATA_KEY,
  CACHE_OPTION_PROVIDER,
} from "./cache.constants";

/**
 * @class CacheProvider
 * @classdesc 承载缓存服务
 * @example CacheService.get(CacheKey).then()
 * @example CacheService.set(CacheKey).then()
 * @example CacheService.promise({ option })()
 * @example CacheService.interval({ option })()
 */
@Injectable()
export class CacheProvider {
  private logger: Logger | LoggerService;

  constructor(
    @Inject("Reflector") private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private cache: ICacheManager,
    @Inject(CACHE_OPTION_PROVIDER) private options: CacheConfig
  ) {
    this.logger = this.options.logger || new Logger(CacheProvider.name);
    this.redisClient.on("ready", () => {
      this.logger.log("Redis已连接！");
    });
  }

  /**
   * 清除 service cache，带参数只会删除指定key，不带会删除整个方法的所有缓存
   * @param property
   */
  public async clearServiceCache(property: Function, ...args: any[]) {
    const redisKey = this.reflector.get(SERVICE_CACHE_METADATA_KEY, property);
    if (!redisKey) {
      return 0;
    }
    const params = {};
    args.forEach((arg, index) => (params[index] = arg));
    const paramString = querystring.stringify(params);
    return this.delAll(`${redisKey}:${paramString}*`);
  }

  public get redisClient(): RedisClient {
    return this.cache.store.getClient();
  }

  // 客户端是否可用
  private get checkCacheServiceAvailable(): boolean {
    return this.redisClient.connected;
  }

  public async exists(...args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.exists(...args, (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret);
        }
      });
    });
  }

  public async setnx(
    key: string,
    value: string | number,
    seconds: number
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.redisClient.set(
        key,
        String(value),
        "EX",
        seconds,
        "NX",
        (err: Error, ret) => {
          if (err) {
            reject(err);
          } else {
            resolve(ret === "OK" ? 1 : 0);
          }
        }
      );
    });
  }

  public get<T>(key: TCacheKey): TCacheResult<T> {
    if (!this.checkCacheServiceAvailable) {
      return Promise.reject(new RedisClientNoReadyException());
    }
    return this.cache.get(key);
  }

  public set<T>(
    key: TCacheKey,
    value: any,
    options?: { ttl: number }
  ): TCacheResult<T> {
    if (!this.checkCacheServiceAvailable) {
      return Promise.reject(new RedisClientNoReadyException());
    }
    return this.cache.set(key, value, options);
  }

  public async del(key: TCacheKey | TCacheKey[]): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.del(key, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
  }

  public async delAll(key: TCacheKey): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.keys(key, async (err, keys) => {
        if (err) {
          reject(err);
        }
        if (keys && keys.length) {
          this.del(keys)
            .then(resolve)
            .catch(reject);
        } else {
          resolve();
        }
      });
    });
  }

  public async incr(key: TCacheKey, seconds?: number): Promise<number> {
    const ret = await new Promise<number>((resolve, reject) => {
      this.redisClient.incr(key, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
    if (seconds) {
      await this.expire(key, seconds);
    }
    return ret;
  }

  public async expire(key: TCacheKey, secords: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.expire(key, secords, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
  }

  public async decr(key: TCacheKey, seconds?: number): Promise<number> {
    const ret = await new Promise<number>((resolve, reject) => {
      this.redisClient.decr(key, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
    if (seconds) {
      await this.expire(key, seconds);
    }
    return ret;
  }

  public setHash(key: TCacheKey, value: object);
  public setHash(key: TCacheKey, subkey: string, value: any);
  public setHash(key: TCacheKey, subkeyOrValue: string | object, value?: any) {
    return new Promise((resolve, reject) => {
      const keys = [key];
      if (!value) {
        value = new Proxy(subkeyOrValue as object, {
          get(target: any, p: PropertyKey): string {
            return JSON.stringify(target[p]);
          },
        });
      } else {
        keys.push(subkeyOrValue as string);
        value = JSON.stringify(value);
      }
      // @ts-ignore
      this.redisClient.hmset(...keys, value, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
      // }
    });
  }

  public delHash(key: string, ...args: string[]) {
    return new Promise((resolve, reject) => {
      this.redisClient.hdel(key, ...args, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count);
        }
      });
    });
  }

  public getHash(key: string);
  public getHash(key: string, subkey: string | string[]);
  public getHash(key: string, subkey?: string | string[]) {
    return new Promise((resolve, reject) => {
      if (subkey) {
        this.redisClient.hmget(key, subkey, (err, reply) => {
          if (err) {
            reject(err);
          } else {
            resolve(reply.map((item) => JSON.parse(item)));
          }
        });
      } else {
        this.redisClient.hgetall(key, (err, reply) => {
          if (err) {
            reject(err);
          } else {
            // resolve(reply);
            resolve(
              reply
                ? new Proxy(reply, {
                    get(target, p: string) {
                      try {
                        return JSON.parse(target[p]);
                      } catch (err) {
                        return target[p];
                      }
                    },
                  })
                : null
            );
          }
        });
      }
    });
  }

  /**
   * @function promise
   * @description 被动更新 | 双向同步 模式，Promise -> Redis
   * @example CacheService.promise({ key: CacheKey, promise() }) -> promise()
   * @example CacheService.promise({ key: CacheKey, promise(), ioMode: true }) -> { get: promise(), update: promise() }
   */
  promise<T>(options: ICachePromiseOption<T>): TCacheResult<T>;
  promise<T>(options: ICachePromiseIoOption<T>): ICacheIoResult<T>;
  promise(options) {
    const { key, promise, ioMode = false } = options;
    // 包装任务
    const doPromiseTask = () => {
      return promise().then((data) => {
        this.set(key, data);
        return data;
      });
    };
    // Promise 拦截模式（返回死数据）
    const handlePromiseMode = () => {
      return this.get(key).then((value) => {
        return value !== null && value !== undefined ? value : doPromiseTask();
      });
    };
    // 双向同步模式（返回获取器和更新器）
    const handleIoMode = () => ({
      get: handlePromiseMode,
      update: doPromiseTask,
    });
    return ioMode ? handleIoMode() : handlePromiseMode();
  }

  /**
   * @function interval
   * @description 定时 | 超时 模式，Promise -> Task -> Redis
   * @example CacheService.interval({ key: CacheKey, promise(), timeout: {} }) -> promise()
   * @example CacheService.interval({ key: CacheKey, promise(), timing: {} }) -> promise()
   */
  public interval<T>(options: ICacheIntervalOption<T>): TCacheIntervalResult<T>;
  public interval<T>(options: ICacheIntervalIOOption<T>): ICacheIoResult<T>;
  public interval<T>(options) {
    const { key, promise, timeout, timing, ioMode = false } = options;
    // 包装任务
    const promiseTask = (): Promise<T> => {
      return promise().then((data) => {
        this.set(key, data);
        return data;
      });
    };
    // 超时任务
    if (timeout) {
      const doPromise = () => {
        promiseTask()
          .then(() => {
            setTimeout(doPromise, timeout.success);
          })
          .catch((error) => {
            const time = timeout.error || timeout.success;
            setTimeout(doPromise, time);
            this.logger.warn(
              `Redis超时任务执行失败，${time / 1000}s 后重试：${error}`
            );
          });
      };
      doPromise();
    }

    // 定时任务
    if (timing) {
      const doPromise = () => {
        promiseTask()
          .then((data) => data)
          .catch((error) => {
            this.logger.warn(
              `Redis定时任务执行失败，${timing.error / 1000}s 后重试：${error}`
            );
            setTimeout(doPromise, timing.error);
          });
      };
      doPromise();
      schedule.scheduleJob(timing.schedule, doPromise);
    }

    // 获取器
    const getKeyCache = () => this.get(key);

    // 双向同步模式（返回获取器和更新器）
    const handleIoMode = () => ({
      get: getKeyCache,
      update: promiseTask,
    });

    // 返回 Redis 获取器
    return ioMode ? handleIoMode() : getKeyCache;
  }
}
