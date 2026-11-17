#!/usr/bin/env python3
"""Builds German_Auto_Mods_Alibaba_Sourcing.xlsx from the research below."""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

A = "https://www.alibaba.com/product-detail/"
# category, product, fits, supplier, location, usd_low, usd_high, moq, url, priority, notes
ROWS = [
 ("Steering wheels", "LED RPM carbon steering wheel", "BMW G20/G30/G42 (M340i, M240i)", "Guangzhou Ohc Electronic Technology Co., Ltd. (Ohc Motors)", "Guangzhou", 90, 325, 1, A+"g20-led-steering-wheel-for-bmw_1600837727389.html", "A", "Same product family as your current G-series wheel. Price is from a third-party aggregator."),
 ("Steering wheels", "LED performance carbon steering wheel", "BMW G20 3 Series / M340i", "Guangzhou Ohc Electronic Technology Co., Ltd. (Ohc Motors)", "Guangzhou", 90, 325, 1, A+"Car-Steering-Wheel-For-Bmw-G20_1600322248430.html", "A", "Second Ohc listing; compare spec and price with the row above."),
 ("Steering wheels", "Custom LED forged carbon / suede wheel", "BMW G20/G21/G30/G31/G80/G82/G87", "Guangzhou Lishida Auto Parts Co., Ltd.", "Guangzhou", None, None, 1, "https://angotan.en.alibaba.com/productgrouplist-802891029/Carbon_Fiber_Steering_Wheel.html", "A", "Storefront carbon wheel range; also lists Mercedes wheels. Ask for the G80 LED quote."),
 ("Steering wheels", "Custom LED forged carbon / blue suede wheel", "BMW M340i G20/G30/G21/G31/G80/G82/G87", "Confirm on listing", "China", 180, 450, 1, A+"For-BMW-M340i-G20-G30-G21_1601206723023.html", "A", "Price band is a general G20/G80 range from an Alibaba guide, not this listing."),
 ("Steering wheels", "Carbon wheels, OEM/ODM custom builds", "BMW and others", "Guangzhou Fine Car Products Co., Ltd.", "Guangzhou", None, None, None, "https://gzjingmei.en.alibaba.com/", "B", "Manufacturer since 2016; offers OEM/ODM, so a candidate for GAM-branded builds."),
 ("Steering wheels", "G20/G80 carbon wheel", "BMW G20/G80", "Guangzhou Yingjie Technology Co., Ltd.", "Guangzhou", 70, 240, 1, "", "B", "Cheapest quoted band (aggregator figure); also sells Audi wheels. Check carbon is real, not hydro-dipped."),
 ("Steering wheels", "Forged carbon + leather wheel (Hycent brand)", "BMW G20/G80", "Hycent (supplier name: confirm)", "Guangdong", 310, 310, 1, "", "B", "Sample price $310. Search Alibaba for 'Hycent steering wheel'."),
 ("Steering wheels", "Custom Alcantara / carbon wheel", "BMW G20/G30/G80", "Xuzhou Onasen Network Technology Co., Ltd.", "Xuzhou", None, None, None, "", "C", "Trading company by name; get a quote only if Guangzhou makers fall through."),
 ("Steering wheels", "Custom carbon + leather wheel", "Mercedes W204/W205 AMG", "Zhongshan Hengsen Automotive Supplies", "Zhongshan", 280, 300, 1, "", "A", "Fills your one-product Mercedes steering wheel collection."),
 ("Steering wheels", "LED carbon wheel", "Mercedes W205 and others", "Hefei Senchi Electronic Technology", "Hefei", 300, 370, 1, "", "B", "LED display version for Mercedes."),
 ("Steering wheels", "Flat-bottom carbon wheel + carbon paddles", "Mercedes W177/W213/W204/W205/W211/C257", "Confirm on listing", "China", 100, 650, 1, A+"Customized-flat-bottom-carbon-fiber-steering_1601320093179.html", "B", "Price band is the general W205 range seen across listings."),
 ("Steering wheels", "Custom carbon LED wheel", "Mercedes W222/W223/W205/W206, C63/E63/G63", "Confirm on listing", "China", 100, 650, 1, A+"Custom-carbon-fiber-steering-wheel-fit_1600318661060.html", "B", "Covers newer W206/W223 cars."),
 ("Steering wheels", "Forged carbon LED wheel", "Audi A3/S3 8V, A4/S4 B8/B9, RS3, Q5, TT and more", "Zhongshan Yuchuang Automotive Supplies", "Zhongshan", 342, 380, 1, "https://www.alibaba.com/showroom/audi-rs3-steering-wheel.html", "A", "Fills your one-product Audi collection."),
 ("Steering wheels", "Half real-carbon LED wheel", "Audi RS3/RS4/RS5/RS6/RS7, B9/B9.5", "Chengdu Xinsheng Tongda", "Chengdu", 213, 600, 1, "https://www.alibaba.com/showroom/custom-audi-steering-wheels.html", "B", "Wide price band depending on spec."),
 ("Steering wheels", "Custom carbon wheel", "VW Golf Mk6/Mk7, GTI, Golf R, Tiguan, Arteon, Polo", "Shenzhen Moge Automotive Parts", "Shenzhen", None, None, 1, A+"Custom-for-Volkswagen-Golf-carbon-fiber_1600530539942.html", "A", "Fills your one-product VW collection."),
 ("Paddle shifters", "Magnetic carbon paddles (CarbonStep)", "BMW G80/G82/G20/G30, X3M/X5M, Supra A90", "Guangzhou Tankuzhe Auto Parts Co., Ltd.", "Guangzhou", None, None, 1, A+"Magnetic-Carbon-Fiber-Paddle-Shifter-for_1601239965618.html", "A", "1-year warranty. You already upsell magnetic paddles at £50 to £100."),
 ("Paddle shifters", "Magnetic carbon paddles (SYPES)", "BMW F15/F20/F22/F30/F32/F36/F80/F87", "Guangzhou Shengyi Auto Supplies", "Guangzhou", None, None, None, A+"SYPES-Magnetic-Carbon-Fiber-Paddle-Shifter_1600863133747.html", "A", "F-series coverage."),
 ("Paddle shifters", "Stick-on carbon paddle extensions (T-carbon)", "BMW G20/G30/G15", "Dongguan Kabo Carbon Fiber", "Dongguan", None, None, None, A+"T-carbon-Carbon-Fiber-Steering-Wheel_1600331791366.html", "B", "Cheap postable add-on; adhesive fit, not a paddle replacement."),
 ("Paddle shifters", "Carbon paddle extensions, custom logo offered", "BMW E46/E90/F10/F30/F36", "Henan Mycar Auto Parts", "Henan", None, None, 1, A+"carbon-fiber-paddle-shift-for-BM_1600657230158.html", "B", "Custom logo option: GAM-branded paddles."),
 ("DRL modules", "RGBW DRL module with aluminium heatsinks", "BMW M3/M4 G80/G82, G22/G23/G26 laser headlights", "Guangzhou Aoyi Auto Part", "Guangzhou", None, None, None, "https://www.alibaba.com/showroom/bmw-rgb-modules.html", "A", "Extends your RGB DRL line from G20 to G80/G82."),
 ("DRL modules", "Yellow / RGB DRL boards", "BMW G20/G21 incl. LCI, M340i", "Guangzhou Carqilight", "Guangzhou", None, None, 1, "https://www.alibaba.com/showroom/m340i-yellow-drl-module.html", "A", "Second source for modules you sell at £300 to £400 fitted. Ask which BMW part number each board replaces."),
 ("DRL modules", "Yellow / RGB DRL boards", "BMW G20", "Chengdu Century Tiancheng Automobile Service Co., Ltd.", "Chengdu", None, None, 1, "https://www.alibaba.com/showroom/led-drl-daytime-running-light-module-bmw-g20.html", "B", "Also sells G20 grilles, so shipments can be combined."),
 ("Tail lights", "M4 CSL-style laser tail lights", "BMW G82 M4 / G22 4 Series", "Confirm on listing", "Guangzhou / Foshan", None, None, None, A+"Hot-sale-new-products-M4-CSL_1601101306163.html", "A", "High-value fitted upgrade. Require E-mark."),
 ("Tail lights", "GTS / OLED 'dragon scale' tail lights (SJC)", "BMW F30/F80, F32/F82", "Guangzhou Meishi Electronic", "Guangzhou", 120, 240, None, "https://www.alibaba.com/showroom/bmw-4-series-tail-lights.html", "A", "Plug-and-play with start-up animation. SJC brand is also credited to Guangzhou Lima Electronic."),
 ("Tail lights", "GTS / OLED tail lights (SJC)", "BMW F30/F35", "Guangzhou Lima Electronic", "Guangzhou", None, None, None, "https://www.alibaba.com/supplier/bmw-m4-csl-tail-lights.html", "B", "Quote against Meishi."),
 ("Ambient lighting", "64-colour ambient light kit (iCarsin)", "BMW G20/G21 2020 to 2024", "iCarsin (supplier name: confirm)", "China", 30, 60, 1, A+"iCarsin-64-Colors-LED-Car-Interior_1601075063586.html", "A", "12V 18W. Low cost and labour-heavy to fit, so good fitted margin."),
 ("Ambient lighting", "64-colour app-controlled ambient kit (KYNCHO)", "BMW F30", "KYNCHO (supplier name: confirm)", "China", 30, 60, 1, "https://www.alibaba.com/supplier/f30-ambient-light-kit-supplier.html", "B", "F30 and G20 kits are different; order per chassis."),
 ("Ambient lighting", "64-colour turbine air vents, front + rear", "Mercedes W205 C-Class / X253 GLC", "Guangzhou Flydee", "Guangzhou", 64, 500, None, A+"C-GLC-Class-64-Color-Air_1700010562284.html", "A", "Price depends on front-only or full set, and whether rotating tweeters are included."),
 ("Carbon exterior", "Dry carbon G80 M3-look mirror caps (replacement type)", "BMW G20/G28", "Confirm on listing", "China", None, None, None, A+"G20-Upgrade-to-G80-M3-Look_1601248878203.html", "A", "Postable and simple to fit. Confirm RHD fitment."),
 ("Carbon exterior", "Carbon mirror covers", "BMW G80 M3 / G82 / G83 M4", "Confirm on listing", "China", None, None, None, A+"Carbon-Fiber-G8x-Rear-View-Mirror_1600629108738.html", "B", "Listing says LHD: ask for the RHD version."),
 ("Carbon exterior", "Dry carbon MP-style front lip (Dongsai T-078)", "BMW G80/G82/G83", "Dongsai (supplier name: confirm)", "China", None, None, None, "https://www.alibaba.com/product-introduction/Dongsai-New-arrival-dry-carbon-front_1600287335932.html", "B", "Bulky: sea freight or consolidated air."),
 ("CarPlay / Android Auto", "Wireless CarPlay decoder (Road Top)", "BMW 1 to 4 Series with NBT EVO", "Road Top (supplier name: confirm)", "Shenzhen", 159, 179, None, "https://www.alibaba.com/showroom/carplay-module.html", "A", "Fits your supplied-and-fitted model."),
 ("CarPlay / Android Auto", "OEM-integration wireless CarPlay box (Champion)", "BMW NBT", "Champion (supplier name: confirm)", "Shenzhen", 99, 160, None, A+"Champion-OEM-Integration-Wireless-CarPlay-Android_1600466271868.html", "B", "Price band is for NBT/EVO/CIC/CCC boxes generally."),
 ("CarPlay / Android Auto", "Wireless CarPlay decoder (Rhythm)", "Mercedes NTG 6.0 MBUX, 2019+", "Rhythm (supplier name: confirm)", "Shenzhen", 114, 175, None, "https://www.alibaba.com/showroom/mercedes-benz-ntg6.0-carplay.html", "A", "NTG5.5/6.0 W205/W177 adapters are also listed at $138 to $168."),
 ("CarPlay / Android Auto", "Wireless CarPlay module (Rhythm / Cartizan)", "Audi A6/A7 MMI 3G 2010 to 2015", "Rhythm; Cartizan (supplier names: confirm)", "Shenzhen", 74, 125, None, "https://www.alibaba.com/showroom/mmi-car.html", "B", "Older Audis without factory CarPlay."),
 ("Dash cams", "OEM-housing 4K front + rear WiFi/GPS dash cam", "Audi A3/A6/A7/A8, Q3/Q5/Q7", "Shenzhen Acar Auto (ACARCAM)", "Shenzhen", 30, 80, None, A+"Integrated-OEM-Housing-Design-Front-and_1600891708497.html", "A", "Sony IMX335, 12-month warranty. Hidden factory look complements your fitted dash cams. Also has a W205/GLC model."),
 ("Dash cams", "OEM hidden 4K dual-lens dash cam (Adinkam)", "BMW 1/3/5 Series, X3/X5; Mercedes W213", "Adinkam (supplier name: confirm)", "Shenzhen", 30, 80, None, A+"ADINKAM-OEM-Hidden-Dash-Camera-Car_1601279563089.html", "A", "Listing fitment shows 2013 to 2016 cars: check newer G-series housings."),
 ("Dash cams", "OEM-look dash cam (HOLROADX)", "BMW 5/7 Series", "HOLROADX (supplier name: confirm)", "Shenzhen", 85, 175, 1, "https://www.alibaba.com/showroom/hidden-cameras-for-mercedes.html", "B", ""),
 ("Dash cams", "Dash cam range", "Various", "Shenzhen Quantu Technology Co., Ltd.", "Shenzhen", None, None, None, "https://dashcamera.en.alibaba.com/", "C", "Dash cam specialist storefront for comparison quotes."),
 ("Digital clusters", "12.3in LCD digital instrument cluster", "BMW F30/F31/F32/F33/F36", "Confirm on listing (Kanor / Mekede / ACAR brands)", "Shenzhen", None, None, None, A+"12-3-inch-LCD-Display-F30_1600529211602.html", "B", "1920x720. Needs coding; odometer must stay accurate."),
 ("Digital clusters", "Linux 12.3in digital cluster (Mekede)", "BMW F30/F31/F34/F32/F33/F36", "Mekede (supplier name: confirm)", "Shenzhen", None, None, None, A+"MEKEDE-Linux-System-12-3-inch-1601033684720.html", "B", ""),
 ("Digital clusters", "12.3in virtual cockpit cluster", "BMW F20/F21/F22/F23, X1 F48, X2", "Confirm on listing", "Shenzhen", None, None, None, A+"Upgrade-car-instrument-smart-virtual-cockpit_1600620218094.html", "C", ""),
 ("Interior trim", "Crystal 3-piece set: gear knob, iDrive, start button", "BMW G20/G28 2020 to 2024, G30, X5 G05", "Guangzhou Hunsui Trading", "Guangzhou", None, None, None, A+"Crystal-Three-piece-Set-Gear-Shift_1600655186589.html", "A", "Small, postable, high perceived value."),
 ("Interior trim", "Crystal gear knob 3-piece kit", "BMW G-chassis 3/4/5/6, X3 to X6", "Zhejiang Vstar Auto Accessories", "Zhejiang", None, None, None, A+"Vstar-made-Crystal-Gear-Shift-Knob-1600460984365.html", "A", "Six-year manufacturer."),
 ("Interior trim", "Crystal knob + start button + iDrive kit", "BMW X5 G05 / X6 / X7, 2019+", "Guangzhou Runda Trading Co., Ltd.", "Guangzhou", 98, 168, None, A+"Custom-and-Wholesale-Auto-Parts-Crystal_1601380142331.html", "B", "A 4-piece RHD start-button kit is also listed at $42 to $63 by another seller."),
 ("Grilles", "Gloss black / silver diamond LED kidney grille (CCTC)", "BMW G20 2019 to 2022", "Chengdu Century Tiancheng (CCTC: confirm)", "Chengdu", None, None, None, A+"Gloss-Black-Silver-G20-Front-Diamond_1601626890856.html", "B", "ABS. Pre-LCI only: LCI needs a different grille."),
 ("Grilles", "RS3-style honeycomb grille", "Audi A3/S3 8V 2013 to 2016 (8V.5 version also sold)", "Changzhou Siwolian; Shenzhen Kingstar (confirm)", "Changzhou / Shenzhen", None, None, None, A+"RS3-front-grille-for-Audi-A3_1601173242481.html", "B", "Order without Audi rings or RS badge."),
]
SUPPLIERS = [
 ("Guangzhou Ohc Electronic Technology Co., Ltd.", "Guangzhou", "LED carbon steering wheels (BMW)", "Two live G20 LED wheel listings; MOQ 1", "First quote for BMW LED wheels"),
 ("Guangzhou Lishida Auto Parts Co., Ltd.", "Guangzhou", "Carbon steering wheels (BMW, Mercedes)", "Storefront with a dedicated carbon wheel range", "Quote alongside Ohc"),
 ("Guangzhou Fine Car Products Co., Ltd.", "Guangzhou", "Carbon wheels and covers, OEM/ODM", "Maker since 2016", "Ask about GAM-branded builds"),
 ("Zhongshan Yuchuang Automotive Supplies", "Zhongshan", "Audi forged carbon LED wheels", "$342 to $380, MOQ 1", "Sample for the Audi collection"),
 ("Zhongshan Hengsen Automotive Supplies", "Zhongshan", "Mercedes carbon + leather wheels", "$280 to $300", "Sample for the Mercedes collection"),
 ("Shenzhen Moge Automotive Parts", "Shenzhen", "VW Golf carbon wheels", "Golf / Golf R fitment list", "Sample for the VW collection"),
 ("Guangzhou Tankuzhe Auto Parts Co., Ltd.", "Guangzhou", "Magnetic carbon paddles (CarbonStep)", "MOQ 1, 1-year warranty", "Order a G-series sample set"),
 ("Guangzhou Shengyi Auto Supplies", "Guangzhou", "Magnetic carbon paddles (SYPES)", "F-series coverage", "Order an F-series sample set"),
 ("Guangzhou Aoyi Auto Part", "Guangzhou", "RGBW DRL modules for G80/G82", "Aluminium heatsinks", "Sample for M3/M4 RGB DRL"),
 ("Guangzhou Carqilight", "Guangzhou", "Yellow / RGB DRL boards", "Listed in Alibaba's DRL buyer guide with review data", "Second source for current DRL range"),
 ("Guangzhou Meishi Electronic", "Guangzhou", "BMW OLED / GTS / CSL tail lights", "$120 to $240", "Ask for E-mark certificate"),
 ("Guangzhou Flydee", "Guangzhou", "Mercedes turbine vent ambient kits", "Front + rear W205 kit", "Sample one W205 set"),
 ("Shenzhen Acar Auto (ACARCAM)", "Shenzhen", "OEM-housing dash cams", "IMX335, 12-month warranty", "Sample BMW, Audi and Mercedes housings"),
 ("Zhejiang Vstar Auto Accessories", "Zhejiang", "BMW crystal gear knob kits", "Six-year manufacturer", "Sample a G20 RHD kit"),
]
CHECKS = [
 ("Before you pay", "Confirm the supplier is a Verified Supplier with Trade Assurance, and pay through Alibaba, not by bank transfer."),
 ("Before you pay", "Order one sample per product first. Every MOQ found was 1 to 2 pieces."),
 ("Before you pay", "Ask for photos or video of the actual unit, not catalogue renders."),
 ("Fitment", "State RHD and UK spec in writing. Several listings are LHD by default."),
 ("Fitment", "Give the exact chassis, year and LCI / pre-LCI status. Many listings claim one part fits every model."),
 ("Fitment", "Steering wheels: confirm airbag fit, heating, lane-assist vibration and ACC button carry-over for the customer's car."),
 ("Branding", "Order every part without BMW, M, AMG, Audi or RS logos. Branded copies are counterfeit and can be seized at UK customs."),
 ("Compliance", "Lights (tail lights, DRL boards) need E-mark approval to be road legal. UK rules require DRLs to show white: say so on coloured DRL listings."),
 ("Compliance", "Electronics need UKCA or CE marking and documentation: ask for the certificate before ordering."),
 ("Compliance", "Digital clusters must show true mileage. Do not sell or fit one that changes the recorded odometer."),
 ("Compliance", "Do not source trackers or immobilisers here: Thatcham / insurance approval comes only through approved UK channels."),
 ("Costs", "Budget duty plus 20% import VAT on top of goods and freight. Duty depends on the 10-digit commodity code: check each product on the UK Trade Tariff (gov.uk)."),
 ("Costs", "All prices in this workbook are indicative figures from search results, not quotes. Get a written quote including shipping to the UK."),
 ("Photos", "Ask each supplier for their unwatermarked photo pack and written permission to use it, then run watermark.py on it."),
]

HEAD = PatternFill("solid", fgColor="111111")
GOLD = Font(bold=True, color="F2B90F")
def sheet(wb, title, headers, rows, widths, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(headers)
    for c in ws[1]:
        c.fill, c.font = HEAD, GOLD
        c.alignment = Alignment(vertical="center", wrap_text=True)
    for r in rows:
        ws.append(list(r))
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    return ws

wb = Workbook()
ws = sheet(wb, "Products",
    ["Category", "Product", "Fits", "Supplier", "Location", "Indicative USD low", "Indicative USD high", "MOQ", "Alibaba link", "Priority", "Notes"],
    ROWS, [20, 40, 36, 40, 16, 12, 12, 7, 50, 9, 60])
for row in ws.iter_rows(min_row=2):
    link = row[8]
    if link.value:
        link.hyperlink = link.value
        link.font = Font(color="0563C1", underline="single")
    else:
        link.value = "Search supplier name on Alibaba"
sheet(wb, "Supplier shortlist", ["Supplier", "Location", "Speciality", "What was found", "Next step"], SUPPLIERS, [48, 14, 40, 46, 38])
sheet(wb, "Checklist", ["Area", "Check"], CHECKS, [18, 120])
out = Path(__file__).resolve().parent / "German_Auto_Mods_Alibaba_Sourcing.xlsx"
wb.save(out)
print(out.name, len(ROWS), "products,", len(SUPPLIERS), "suppliers")
