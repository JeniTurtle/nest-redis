import { CACHE_KEY_METADATA } from '@nestjs/common/cache/cache.constants';

export const HTTP_CACHE_KEY_METADATA = CACHE_KEY_METADATA;
export const HTTP_CACHE_TTL_METADATA = '__CustomHttpCacheTTL__';
export const SERVICE_CACHE_METADATA_KEY = '__ServiceCacheMetadataKey__';
export const CACHE_OPTION_PROVIDER = Symbol('cache_option_provider');
