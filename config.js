// Where AI Jimmy's brain lives (pluggable). The passcode is NOT stored here; it's checked server-side.
window.SULLIVAN_CONFIG = {
  chatEndpoint: 'https://kwwpjzwhuxpcqlidqnwl.supabase.co/functions/v1/sullivan-chat',
  // Public Supabase anon key (safe to ship; it only lets the app call the function).
  apiKeyHeader: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d3BqendodXhwY3FsaWRxbndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Mjg0ODIsImV4cCI6MjA5MjIwNDQ4Mn0.BUSXMw3lcyV5oO2oeO2ZXoPoRPE7fdF3yK-LpvhhRW0'
};
