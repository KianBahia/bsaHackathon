/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Force Next.js to bundle TonConnect packages through its own webpack pipeline
  // so they share the same React instance instead of bundling their own copy.
  // Without this, @tonconnect/ui-react conflicts with React 19 in Telegram's WebView.
  transpilePackages: ["@tonconnect/ui-react", "@tonconnect/ui", "@tonconnect/sdk"],
};

module.exports = nextConfig;
