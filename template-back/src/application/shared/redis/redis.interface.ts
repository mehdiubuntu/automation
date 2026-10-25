export const CACHE_SERVICE_TOKEN = Symbol('CACHE_SERVICE_TOKEN')
export interface ICacheService {
  /**
   * Sends a PING command to Redis to verify the connection.
   * Useful for health checks or readiness probes.
   *
   * Returns: "PONG" if the Redis server is reachable.
   */
  ping(): Promise<string>

  /**
   * Retrieves the string value stored at the given key.
   *
   * Returns:
   * - the stored string value
   * - null if the key does not exist
   */
  get(key: string): Promise<string | null>

  /**
   * Retrieves a JSON value stored at the given key and parses it.
   *
   * This assumes the value was previously stored using JSON.stringify.
   *
   * Returns:
   * - parsed object of type T
   * - null if the key does not exist
   */
  getJson<T>(key: string): Promise<T | null>

  /**
   * Stores a string value at the given key.
   *
   * Optionally sets a TTL (time-to-live) in seconds after which the key expires.
   *
   * Returns:
   * - "OK" if the operation succeeds
   * - null if the command fails
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null>

  /**
   * Stores an object as JSON at the given key.
   *
   * The object is automatically serialized using JSON.stringify.
   * Optionally accepts a TTL in seconds.
   */
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK' | null>

  /**
   * Deletes the given key from Redis.
   *
   * Returns:
   * - number of keys removed (0 if key did not exist)
   */
  del(key: string): Promise<number>

  /**
   * Checks whether the given key exists in Redis.
   *
   * Returns:
   * - true if the key exists
   * - false otherwise
   */
  exists(key: string): Promise<boolean>

  /**
   * Pushes a value to the head (left side) of a Redis list.
   *
   * Commonly used for queues or stacks.
   *
   * Returns:
   * - the new length of the list
   */
  lpush(key: string, value: string): Promise<number>

  /**
   * Retrieves a range of elements from a Redis list.
   *
   * Parameters:
   * - start: starting index (default 0)
   * - stop: ending index (default -1 meaning end of list)
   *
   * Returns:
   * - an array of list elements
   */
  lrange(key: string, start?: number, stop?: number): Promise<string[]>

  /**
   * Removes elements equal to `value` from a Redis list.
   *
   * Parameters:
   * - count:
   *   > 0  remove from head to tail
   *   < 0  remove from tail to head
   *   = 0  remove all matching elements
   *
   * Returns:
   * - number of removed elements
   */
  lrem(key: string, count: number, value: string): Promise<number>

  /**
   * Attempts to acquire a distributed lock using Redis.
   *
   * Uses SET NX with TTL to ensure only one process acquires the lock.
   *
   * Returns:
   * - a unique lock token if lock is acquired
   * - null if the lock is already held
   *
   * The returned token must be used when releasing the lock.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<string | null>

  /**
   * Releases a distributed lock if the stored lock token matches.
   *
   * Uses a Lua script to ensure atomic verification and deletion.
   * This prevents accidentally releasing a lock owned by another process.
   *
   * Returns:
   * - true if the lock was successfully released
   * - false if the lock token did not match
   */
  releaseLock(key: string, lockValue: string): Promise<boolean>
}
