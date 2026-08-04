import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Basics',
      items: [
        'basics/about',
        'basics/about-bch',
        'basics/getting-started',
        'basics/solidity-parity',
        'basics/platform-differences',
      ],
    },
    {
      type: 'category',
      label: 'Language Description',
      items: [
        'language/contracts',
        'language/types',
        'language/functions',
        'language/data-locations',
        'language/structs-enums-types',
        'language/modifiers',
        'language/inheritance',
        'language/imports-interfaces',
        'language/libraries',
        'language/events-errors',
        'language/stateful-contracts',
        'language/contract-creation',
        'language/globals',
        'language/builtin-functions',
        'language/cryptography',
        'language/assembly',
        'language/advanced-features',
        'language/examples',
        'language/syntax-highlighting'
      ],
    },
    {
      type: 'category',
      label: 'Compiler',
      items: [
        'compiler/compiler',
        'compiler/script-limits',
        'compiler/artifacts',
        'compiler/grammar',
      ],
    },
    {
      type: 'category',
      label: 'TypeScript SDK',
      items: [
        'sdk/typescript-sdk',
        'sdk/instantiation',
        'sdk/transaction-builder',
        'sdk/stateful-contracts',
        'sdk/threading',
        'sdk/test-matchers',
        {
          type: 'category',
          label: 'Network Providers',
          items: [
            'sdk/network-provider',
            'sdk/electrum-network-provider',
            'sdk/other-network-providers',
          ],
        },
        'sdk/signature-templates',
        'sdk/testing-setup',
        'sdk/examples',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/stateful-guide',
        'guides/covenants',
        'guides/lifecycle',
        'guides/cashtokens',
        'guides/deployment',
        'guides/concurrency',
        'guides/infrastructure',
        'guides/walletconnect',
        'guides/debugging',
        'guides/optimization',
        'guides/adversarial',
      ],
    },
    {
      type: 'category',
      label: 'Releases',
      items: [
        'releases/release-notes',
        'releases/migration-notes',
      ],
    },
    'showcase',
  ],
};

export default sidebars;
