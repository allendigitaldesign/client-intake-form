/* ---------------------------------------------------------------------------
   questions.js — the only file you need to edit for a new client.

   Change the copy and the questions here. Nothing else in the project needs
   to be touched. See README.md for the walkthrough.

   Field types:
     text      single-line answer
     textarea  multi-line answer
     radio     pick one from `options`
     files     file upload (images + PDFs)

   Every field is optional — the form can always be submitted part-finished.
   --------------------------------------------------------------------------- */

window.FORM_CONFIG = {

  /* Shown at the top of the page and used in the email subject line. */
  title: "Let's build your gym a website",

  intro: "Seven short rounds. Answer what you can — anything you skip, we'll sort out on a call. Your answers save on this device as you type, so you can stop and come back.",

  /* Appears on the confirmation screen after a successful submit. */
  confirmation: {
    heading: "That's it — it's through.",
    body: "Everything you sent landed with me, photos included. I'll go through it and come back to you with next steps. Nothing else for you to do."
  },

  sections: [

    /* ----- Gym basics (no section number) ------------------------------- */
    {
      id: "basics",
      number: null,
      heading: "Gym basics",
      blurb: null,
      fields: [
        {
          id: "gym_name",
          type: "text",
          label: "Gym name",
          placeholder: "Exactly how you want it written"
        },
        {
          id: "street_address",
          type: "text",
          label: "Street address"
        },
        {
          id: "phone_email",
          type: "text",
          label: "Phone and email you want on the site"
        },
        {
          id: "opening_hours",
          type: "textarea",
          label: "Opening hours",
          hint: "Or just the hours the doors are unlocked, if classes vary."
        },
        {
          id: "social_links",
          type: "textarea",
          label: "Links to your Instagram, Facebook, TikTok, anything else",
          hint: "Paste the links — no need to tidy them up."
        },
        {
          id: "current_website",
          type: "text",
          label: "Current website, if you have one"
        }
      ]
    },

    /* ----- 1. Your logo and colors -------------------------------------- */
    {
      id: "logo",
      number: "1",
      heading: "Your logo and colors",
      blurb: "Whatever you already put on shirts, banners and gloves.",
      fields: [
        {
          id: "logo_status",
          type: "radio",
          label: "Do you have a logo?",
          options: [
            "Yes — I can send the original files",
            "Yes, but only a photo or a low-res copy",
            "No, I'd need one made"
          ]
        },
        {
          id: "colors_fonts",
          type: "textarea",
          label: "Colors and fonts you already use",
          hint: "Plain words are fine: “red and black, same as the shirts.”"
        },
        {
          id: "branding_items",
          type: "textarea",
          label: "Anything else that carries your branding",
          hint: "Shirts, wraps, the sign out front, a banner in the ring."
        },
        {
          id: "logo_files",
          type: "files",
          label: "Logo files",
          note: "The highest quality version you have, even if it's the one your printer used."
        }
      ]
    },

    /* ----- 2. Photos of the gym ----------------------------------------- */
    {
      id: "photos",
      number: "2",
      heading: "Photos of the gym",
      blurb: "Real photos of your place beat stock photos every time. This is the single biggest thing that will make the site look like yours.",
      fields: [
        {
          id: "photos_status",
          type: "radio",
          label: "What do you have right now?",
          options: [
            "A good set of recent photos",
            "A handful of phone shots",
            "Basically nothing usable"
          ]
        },
        {
          id: "photo_subjects",
          type: "textarea",
          label: "Who and what should definitely be in the pictures",
          hint: "Coaches, the ring, the bag room, a class in full swing, fight night."
        },
        {
          id: "photos_more",
          type: "radio",
          label: "Could someone shoot more if we need them?",
          options: [
            "Yes, easily",
            "Maybe, with some notice",
            "No — we'd need to hire someone"
          ]
        },
        {
          id: "gym_photos",
          type: "files",
          label: "Photos of the gym",
          note: "Send as many as you like. Straight off your phone is fine."
        }
      ]
    },

    /* ----- 3. The one thing a visitor should do -------------------------- */
    {
      id: "action",
      number: "3",
      heading: "The one thing a visitor should do",
      blurb: "Every page will be built to push people toward one action. Pick the one that matters most — not all of them.",
      fields: [
        {
          id: "primary_action",
          type: "radio",
          label: "When someone lands on the site, what do you want them to do?",
          options: [
            "Book a free trial class",
            "Call the gym",
            "Sign up for a membership online",
            "Just show up for a session",
            "Fill out a contact form",
            "Something else"
          ]
        },
        {
          id: "primary_action_other",
          type: "text",
          label: "If you picked “something else,” what is it?"
        },
        {
          id: "first_visit_reason",
          type: "textarea",
          label: "What usually gets someone through the door the first time?",
          hint: "What do new people say when they walk in? That line often becomes the headline."
        }
      ]
    },

    /* ----- 4. Classes, schedule and pricing ------------------------------ */
    {
      id: "classes",
      number: "4",
      heading: "Classes, schedule and pricing",
      blurb: "The part people scroll looking for. Rough notes are fine — I'll format it.",
      fields: [
        {
          id: "offerings",
          type: "textarea",
          label: "What you offer",
          hint: "Beginner group, sparring, kids, women's class, personal training, open gym."
        },
        {
          id: "schedule",
          type: "textarea",
          label: "Weekly schedule",
          hint: "Days and times. Paste it however you already have it written down."
        },
        {
          id: "pricing",
          type: "textarea",
          label: "Memberships and prices",
          hint: "Drop-in, monthly, class packs, family rates, anything with a number on it."
        },
        {
          id: "show_prices",
          type: "radio",
          label: "Should prices be on the site?",
          options: [
            "Yes, put them up",
            "No — I'd rather they call or come in",
            "Not sure, tell me what you think"
          ]
        }
      ]
    },

    /* ----- 5. Sites you like --------------------------------------------- */
    {
      id: "taste",
      number: "5",
      heading: "Sites you like",
      blurb: "This tells me more about your taste in two minutes than an hour of me describing styles.",
      fields: [
        {
          id: "site_1",
          type: "text",
          label: "A site you like",
          placeholder: "Any site — doesn't have to be a gym"
        },
        { id: "site_1_why", type: "text", label: "What you like about it" },
        { id: "site_2", type: "text", label: "Another one" },
        { id: "site_2_why", type: "text", label: "What you like about it" },
        { id: "site_3", type: "text", label: "One more, if you've got it" },
        { id: "site_3_why", type: "text", label: "What you like about it" },
        {
          id: "dislikes",
          type: "textarea",
          label: "Anything you definitely don't want",
          hint: "Styles, colors, or a competitor's site that rubs you the wrong way."
        }
      ]
    },

    /* ----- 6. The corner -------------------------------------------------- */
    {
      id: "corner",
      number: "6",
      heading: "The corner",
      blurb: "The story behind the gym. This is usually the strongest thing a gym has, and most websites leave it out.",
      fields: [
        {
          id: "who_runs",
          type: "textarea",
          label: "Who runs the gym, and how they got here"
        },
        {
          id: "credentials",
          type: "textarea",
          label: "Record, titles, fighters you've trained, years in the sport",
          hint: "Anything that tells a stranger you know what you're doing."
        },
        {
          id: "describe_gym",
          type: "textarea",
          label: "Describe your gym to someone who's never been in one",
          hint: "One or two sentences, your own words."
        }
      ]
    },

    /* ----- 7. Anything else ----------------------------------------------- */
    {
      id: "extra",
      number: "7",
      heading: "Anything else",
      blurb: "Last call.",
      fields: [
        {
          id: "anything_else",
          type: "textarea",
          label: "Anything I didn't ask about"
        },
        {
          id: "extra_files",
          type: "files",
          label: "Anything else",
          note: "Old flyers, a menu of rates, a logo mockup someone made."
        }
      ]
    }

  ]
};
