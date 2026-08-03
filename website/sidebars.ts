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
      ],
    },
    {
      type: 'category',
      label: 'Language Description',
      items: [
        'language/contracts',
        'language/types',
        'language/functions',
        'language/globals',
        'language/stateful-contracts',
        'language/structs-enums-types',
        'language/inheritance',
        'language/modifiers',
        'language/events-errors',
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
        'guides/state-journal',
        'guides/message-bus',
        'guides/covenants',
        'guides/lifecycle',
        'guides/cashtokens',
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
