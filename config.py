"""Business details for SGT Repairs. Edit this file to change anything shown on the site."""

BUSINESS = {
    "name": "SGT Repairs",
    "tagline": "Your local East London garage",
    "phone_display": "07988 398813",
    "phone_tel": "+447988398813",
    "street": "79-81 Cobbold Road",
    "area": "Leytonstone",
    "city": "London",
    "postcode": "E11 3NS",
    "maps_query": "SGT Repair, 79-81 Cobbold Road, London E11 3NS",
    "timezone": "Europe/London",
}

# Monday = 0 ... Sunday = 6. None means closed.
HOURS = {
    0: ("10:00", "18:00"),
    1: ("10:00", "18:00"),
    2: ("10:00", "18:00"),
    3: ("10:00", "18:00"),
    4: ("10:00", "18:00"),
    5: ("10:00", "17:00"),
    6: None,
}

# Booking rules
CAPACITY = 2            # two mechanics = two cars can be booked into the same slot
SLOT_MINUTES = 60       # length of a drop-off slot
LEAD_MINUTES = 120      # earliest bookable slot is this far from now
BOOKING_WINDOW_DAYS = 28

SERVICES = [
    {"id": "service", "name": "Servicing",
     "blurb": "Interim and full services for every make and model, done by the book."},
    {"id": "diagnostics", "name": "Diagnostics",
     "blurb": "Warning light on? We find the fault and explain it in plain English."},
    {"id": "brakes", "name": "Brakes",
     "blurb": "Pads, discs, calipers and fluid. Checked properly, fitted properly."},
    {"id": "clutch", "name": "Clutch & gearbox",
     "blurb": "Clutch replacements, gearbox repairs and everything in between."},
    {"id": "engine", "name": "Engine work",
     "blurb": "Timing belts, head gaskets, tuning and carbon cleaning."},
    {"id": "suspension", "name": "Suspension & steering",
     "blurb": "Knocks, rattles and pulling to one side, sorted."},
    {"id": "mot", "name": "MOT prep & repairs",
     "blurb": "Pre-MOT checks and failure repairs to get you back on the road."},
    {"id": "electrics", "name": "Battery & electrics",
     "blurb": "Batteries, alternators, starter motors and electrical faults."},
    {"id": "other", "name": "Something else",
     "blurb": "Not sure what's wrong? Book in and tell us what you're noticing."},
]

FAQS = [
    ("What work do you take on?",
     "All mechanical work. Servicing, brakes, clutches, engines, suspension, diagnostics, "
     "electrics and MOT repairs, on all makes and models. If you're not sure, call us."),
    ("How does online booking work?",
     "Pick the job, pick a free slot and leave your details. Your booking goes straight into "
     "our workshop calendar, so the slot you see is the slot you get."),
    ("Will I know the price before work starts?",
     "Yes. We look at the car, tell you what it needs and what it will cost. "
     "Nothing gets done until you've said yes."),
    ("Can I just call instead?",
     "Of course. Ring us during opening hours and you'll speak to one of the two mechanics "
     "who will actually work on your car."),
    ("What if I need to change my booking?",
     "Give us a call with your booking reference and we'll move it for you."),
]
