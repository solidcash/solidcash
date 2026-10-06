/**
 * Golden vectors for category pins, derived addresses and the loader lock.
 *
 * The addresses are `P2SH32(HASH256(push(pin(chain(category), MUTABLE)) || validator program))`, computed once
 * outside the module under test from the categories and programs below. Every value here is a hex string so the
 * vectors are plain data.
 */

/** A user's 20-byte public key hash. */
export const USER_PUBKEY_HASH = '751e76e8199196d454941c45d1b3a323f1433bd6';

/** The user's P2PKH locking bytecode: how a user's address appears in the canonical encoding. */
export const USER_LOCK = '76a914751e76e8199196d454941c45d1b3a323f1433bd688ac';

/** `catA` and `catB`: the two sample state categories. */
export const CATEGORY_A = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
export const CATEGORY_B = '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f';

/** The sample validator program `V_TEMPLATE`, and a second one differing in its last byte. */
export const VALIDATOR_TEMPLATE = '76a988ac';
export const VALIDATOR_TEMPLATE_ALT = '76a988ad';

/** The loader locks the sample masters sit at: `P2SH32(HASH256(code_A))` and `P2SH32(HASH256(code_B))`. */
export const LOADER_CODE_A = '5187';
export const LOADER_CODE_B = '5287';
export const MASTER_LOADER_LOCK_A = 'aa203b647cb856a965fa6feffb4621eb2a4f4c2453693b2f64e021383ccbd80a1abb87';
export const MASTER_LOADER_LOCK_B = 'aa2037772654bdce9b3d59e1169ea16ddbaa8a2ae8ee265db64863d0b76f02c882fa87';

/** The four-byte dispatcher selectors of the sample functions. */
export const SELECTOR_F = '01020304';
export const SELECTOR_G = '05060708';
export const SELECTOR_K = '0d0e0f10';

/** `addrV(catA)` and `addrV(catB)` with `V_TEMPLATE`, and `addrV(catA)` with the alternate program. */
export const ADDRESS_A = 'aa206e2108a8f5c71b143db4c7ab4ea90811a8be07554be9c4251358a853146251f687';
export const ADDRESS_B = 'aa20f0da95af8a018b638eebcad93c163e3123a97a259cf0609319e3684e8c36fb2187';
export const ADDRESS_A_ALT_PROGRAM = 'aa20f080d52d4945d3ce976cbc0c215d5ae199ae60564751ee42e85b70def01cfa9d87';

/**
 * `push(pin(catA, MUTABLE)) || V_TEMPLATE`, the validator's redeem script.
 *
 * The pin is data and is pushed: a bare category is 32 arbitrary bytes, and the machine would execute them as
 * opcodes if they sat in front of the program unquoted.
 */
export const VALIDATOR_REDEEM_SCRIPT_A
  = '21201f1e1d1c1b1a191817161514131211100f0e0d0c0b0a0908070605040302010176a988ac';

/** `SHA256(V_TEMPLATE)`, the constant a master carries and recognises through. */
export const VALIDATOR_TEMPLATE_HASH = '5aa55ada21ec40dd1152fe335cc72aa84163a4e00d611ea2d5272bda88fdaa1e';

/**
 * `categoryPinScript(catA, MUTABLE)`: the 0x21 push of the 33-byte pin, then
 * `OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY` (0xc0 0xce 0x88).
 */
export const CATEGORY_PIN_SCRIPT_A = '21201f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020101c0ce88';
