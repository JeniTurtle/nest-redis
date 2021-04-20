import * as querystring from "querystring";
import * as lodash from "lodash";
import { SetMetadata } from "@nestjs/common";
import { PROPERTY_DEPS_METADATA } from "@nestjs/common/constants";
import { ICacheOption, IServiceCacheOptions } from "./cache.interface";
import { SERVICE_CACHE_METADATA_KEY } from "./cache.constants";
import { CacheProvider } from "./cache.provider";

/**
 * 统配构造器
 * @function ServiceCache
 * @description 两种用法
 * @example @ServiceCache(60 * 60)
 * @example @ServiceCache(CACHE_KEY, 60 * 60)
 * @example @ServiceCache({ key: CACHE_KEY, ttl: 60 * 60 })
 */
export function ServiceCache(option: ICacheOption): MethodDecorator;
export function ServiceCache(ttl?: number): MethodDecorator;
export function ServiceCache(key: string, ttl?: number): MethodDecorator;
export function ServiceCache(...args) {
  return (target, property, descriptor: PropertyDescriptor) => {
    let defaultProp = "cacheProvider";
    let properties =
      Reflect.getMetadata(PROPERTY_DEPS_METADATA, target.constructor) || [];
    const cacheProperty = properties.find(
      (item) => item.type === CacheProvider.name
    );
    if (!cacheProperty) {
      properties = [
        ...properties,
        { key: defaultProp, type: CacheProvider.name },
      ];
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        properties,
        target.constructor
      );
    } else if (cacheProperty.key !== defaultProp) {
      defaultProp = cacheProperty.key;
    }
    const option = args[0];
    const defaultKey = `ServiceCache:${target.constructor.name}_${property}`;
    const isOption = (value): value is ICacheOption => lodash.isObject(value);
    const key: string = isOption(option)
      ? option.key
      : lodash.isString(option)
      ? option
      : defaultKey;
    const ttl: number = isOption(option)
      ? option.ttl
      : args[1] || (lodash.isString(option) ? null : args[0]);
    const fn = descriptor.value;
    if (!lodash.isFunction(fn)) {
      return descriptor;
    }
    descriptor.value = async function(...args) {
      // 如果方法最后一个参数的__updateCache属性为true，强制更新缓存
      let options: IServiceCacheOptions = lodash.last(args);
      if (!lodash.isObject(options) || options.__updateCache === undefined) {
        options = { __updateCache: false };
      }
      const params = {};
      args.forEach((arg, index) => {
        if (lodash.isObject(arg) && options.__updateCache !== undefined) {
          return;
        }
        params[index] = lodash.isObject(arg) ? JSON.stringify(arg) : arg;
      });
      const paramString = querystring.stringify(params);
      const fullKey = `${key}:${paramString}`;
      const result =
        options.__updateCache === true
          ? null
          : await this[defaultProp].get(fullKey);
      if (result) {
        return result;
      }
      const data = await fn.apply(this, args);
      if (data) {
        await this[defaultProp].set(fullKey, data, { ttl });
      }
      return data;
    };
    SetMetadata(SERVICE_CACHE_METADATA_KEY, key)(descriptor.value);
    return descriptor;
  };
}
