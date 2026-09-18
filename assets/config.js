/* ---------------------------------------------------------------------------
   config.js — backend settings. Set once, then leave alone.
   See README.md if any of these ever need changing.
   --------------------------------------------------------------------------- */

window.BACKEND_CONFIG = {

  /* Supabase project API URL, e.g. https://abcdefgh.supabase.co */
  supabaseUrl: "https://nbcqybbaeygqhxwfqidq.supabase.co",

  /* Publishable / anon key. Safe to ship in the browser: it can only add
     files to the upload bucket and call the submit function. */
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iY3F5YmJhZXlncWh4d2ZxaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjYxNzIsImV4cCI6MjEwNTM0MjE3Mn0.zU0Ys2JyLve1ke4oojiGcsbQMsvK0YHaJVMjeIJH_t4",

  /* Storage bucket that receives uploads. */
  bucket: "intake-uploads",

  /* Edge function that stores the answers and emails them over. */
  functionName: "submit-intake",

  /* Biggest single file the form will accept, in bytes. 30 MB. */
  maxFileBytes: 31457280,

  /* localStorage key. Give each client their own so two forms never
     read back each other's half-finished answers. */
  storageKey: "add-intake:leroys-boxing-gym:v1"
};
