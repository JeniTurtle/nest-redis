import { ClientOpts } from 'redis';
import { FactoryProvider, Logger, LoggerService } from '@nestjs/common';

// Cache 客户端管理器
export interface ICacheManager {
  store: any;
  get(key: TCacheKey): any;
  set(key: TCacheKey, value: string, options?: { ttl: number }): any;
}

export interface CacheConfig extends ClientOpts {
  logger?: Logger | LoggerService;
}

export interface CacheAsyncConfig {
  name?: string;
  useFactory: (...args: any[]) => Promise<CacheConfig> | CacheConfig;
  inject?: FactoryProvider['inject'];
}

// 获取器
export type TCacheKey = string;
export type TCacheResult<T> = Promise<T>;

// IO 模式通用返回结构
export interface ICacheIoResult<T> {
  get(): TCacheResult<T>;
  update(): TCacheResult<T>;
}

// Promise 模式参数
export interface ICachePromiseOption<T> {
  key: TCacheKey;
  promise(): TCacheResult<T>;
}

// Promise & IO 模式参数
export interface ICachePromiseIoOption<T> extends ICachePromiseOption<T> {
  ioMode?: boolean;
}

// Interval & Timeout 超时模式参数
export interface ICacheIntervalTimeoutOption {
  error?: number;
  success?: number;
}

// Interval & Timing 定时模式参数
export interface ICacheIntervalTimingOption {
  error: number;
  schedule: any;
}

// Interval 模式参数
export interface ICacheIntervalOption<T> {
  key: TCacheKey;
  promise(): TCacheResult<T>;
  timeout?: ICacheIntervalTimeoutOption;
  timing?: ICacheIntervalTimingOption;
}

// Interval 模式返回类型
export type TCacheIntervalResult<T> = () => TCacheResult<T>;

// Interval & IO 模式参数
export interface ICacheIntervalIOOption<T> extends ICacheIntervalOption<T> {
  ioMode?: boolean;
}

// 缓存器配置
export interface ICacheOption {
  ttl?: number;
  key?: string;
}

export interface IServiceCacheOptions {
  __updateCache: boolean;
}
