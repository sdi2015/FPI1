"""
FPI Warranty Module - Preview Server
Simple HTTP server to preview the warranty dashboard module
No external dependencies required - uses Python built-in http.server
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
from pathlib import Path
import time
import threading

class WarrantyModuleHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{self.log_date_time_string()}] {args[0]}")

def open_browser(port):
    """Open browser after a short delay"""
    time.sleep(1.5)
    url = f"http://localhost:{port}"
    print(f"\nOpening browser to: {url}")
    webbrowser.open(url)

def run_server(port=5174):
    """Run the preview server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, WarrantyModuleHandler)
    
    print("="*70)
    print("FPI WARRANTY MODULE - LOCALHOST PREVIEW SERVER")
    print("="*70)
    print(f"Server running at: http://localhost:{port}")
    print(f"Module Location: {Path.cwd()}")
    print(f"Main Dashboard: http://localhost:{port}/index.html")
    print("="*70)
    print("Press Ctrl+C to stop server")
    print("="*70)
    
    # Open browser in background thread
    browser_thread = threading.Thread(target=open_browser, args=(port,))
    browser_thread.daemon = True
    browser_thread.start()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
        httpd.shutdown()

if __name__ == '__main__':
    run_server(5174)
