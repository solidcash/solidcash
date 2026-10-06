/**
 * The send queue for framed composition: a plan whose sends could touch the same masters, validators or records
 * is built and broadcast one after the other, while sends with disjoint resources run concurrently.
 */

export * from './queue.js';
