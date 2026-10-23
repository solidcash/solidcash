import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type { Options as ClassicPresetOptions } from '@docusaurus/preset-classic';

const config: Config = {
  title: 'SolidCash',
  tagline: 'Smart contracts for Bitcoin Cash',
  url: 'https://solidcash.org',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'SolidCash',
  projectName: 'solidcash',
  themeConfig: {
    prism: {
      theme: prismThemes.nightOwlLight,
      darkTheme: prismThemes.nightOwl,
      additionalLanguages: ['solidity', 'antlr4'],
    },
    image: 'img/logo.svg',
    navbar: {
      logo: {
        alt: 'SolidCash',
        src: 'img/logo.svg',
      },
      items: [
        { to: '/docs/basics/about', label: 'Docs', position: 'right' },
        // Hidden until the playground is deployed:
        // { href: 'https://playground.solidcash.org', label: 'Playground', position: 'right' },
        {
          href: 'https://github.com/solidcash/solidcash',
          label: 'GitHub',
          position: 'right',
        },
      ],
      style: 'dark',
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/basics/getting-started',
            },
            {
              label: 'Examples',
              to: '/docs/language/examples',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Telegram',
              href: 'https://t.me/SolidCashBCH',
            },
            {
              label: 'Showcase',
              to: '/docs/showcase',
            },
          ],
        },
        {
          title: 'Social',
          items: [
            {
              label: 'Kalis.me',
              href: 'https://kalis.me',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/SolidCashBCH',
            },
          ],
        },
      ],
      copyright: `<b>Donations:</b> bitcoincash:qzlhhdh5ma2ehcxmwqx3xfc6fla3854p3c8zu625kl`,
    },
  },
  presets: [
    [
      'classic',
      {
        theme: {
          customCss: './src/css/custom.css',
        },
        docs: {
          sidebarPath: './sidebars.ts',
        },
      } as ClassicPresetOptions,
    ],
  ],
  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        fromExtensions: ['html'],
        redirects: [
          { from: ['/docs', '/docs/about', '/docs/basics'], to: '/docs/basics/about' },
          { from: '/docs/language', to: '/docs/language/contracts' },
          { from: '/docs/sdk', to: '/docs/sdk/instantiation' },
          { from: '/docs/sdk/transactions-advanced', to: '/docs/sdk/transaction-builder' },
          { from: '/docs/guides', to: '/docs/guides/covenants' },
          { from: '/docs/guides/syntax-highlighting', to: '/docs/language/syntax-highlighting' },
          { from: '/docs/getting-started', to: '/docs/basics/getting-started' },
          { from: '/docs/examples', to: '/docs/language/examples' },
        ],
      },
    ],
    ['@branchup/docusaurus-plugin-simple-analytics', {}],
  ],
};

export default config;
