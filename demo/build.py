"""Build a static, server-free demo of the site into demo/dist (bookings are simulated)."""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import app as site  # noqa: E402
import config  # noqa: E402

DIST = os.path.join(ROOT, "demo", "dist")
b = config.BUSINESS
html = site.app.test_client().get("/").get_data(as_text=True)

html = html.replace('"/static/', '"static/').replace(", viewport-fit=cover", "")
html = re.sub(r'<meta property="og:image"[^>]*>\n?', "", html)
html = re.sub(r'<iframe.*?</iframe>', (
    '<div class="demo-map"><strong>{street}</strong><span>{area}, {city} {postcode}</span>'
    '<em>The live site shows an interactive Google map here.</em></div>').format(**b),
    html, flags=re.S)
html = html.replace('"timezone":', '"address": "%s, %s, %s %s", "timezone":'
                    % (b["name"], b["street"], b["city"], b["postcode"]))
html = html.replace("</head>", """<style>
.demo-bar{position:relative;z-index:70;background:#1b74f5;color:#fff;text-align:center;font-size:13px;font-weight:600;padding:7px 14px}
.demo-bar ~ .nav{top:32px}.demo-bar ~ .nav.is-stuck{top:0}
.demo-map{height:100%;display:grid;place-content:center;gap:6px;text-align:center;padding:30px;color:#6e6e73;background:
 linear-gradient(#e3e6ec 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,#e3e6ec 1px,transparent 1px) 0 0/48px 48px,#f5f5f7}
.demo-map strong{font-size:24px;color:#1d1d1f;letter-spacing:-.02em}.demo-map em{font-style:normal;font-size:13px;margin-top:10px}
#doneIcs{display:none}
</style></head>""")
html = html.replace('<a class="skip"', '<div class="demo-bar">Demo preview. Bookings made here are not real and nothing is saved.</div>\n<a class="skip"', 1)
html = html.replace('<script src="static/js/main.js', '<script src="static/js/demo.js" defer></script>\n<script src="static/js/main.js')

shutil.rmtree(DIST, ignore_errors=True)
shutil.copytree(os.path.join(ROOT, "static"), os.path.join(DIST, "static"))
shutil.copy(os.path.join(ROOT, "demo", "demo.js"), os.path.join(DIST, "static", "js", "demo.js"))
with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as fh:
    fh.write(html)
print("Built", DIST)
