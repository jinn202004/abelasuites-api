const guestService = require("../services/guest.service");



/**

 * Logged-in user's hotel guest profile (Guest collection), if any.

 */

exports.getMe = async (req, res) => {

  const doc = await guestService.findGuestByUserId(req.user.id);

  if (!doc) {

    return res.json({

      guest: null,

      message: "No guest profile linked to this account yet (e.g. after first booking it will appear).",

    });

  }

  const shape = guestService.toBillingGuestShape(doc);

  res.json({

    guest: {

      id: doc._id,

      name: shape.name,

      email: shape.email,

      contactNumber: shape.contactNumber,

      displayName: doc.displayName ?? "",

      phone: doc.phone ?? "",

      address: doc.address ?? "",

      profilePhotoData: doc.profilePhotoData ?? "",

      userId: doc.userId ?? null,

      createdAt: doc.createdAt,

      updatedAt: doc.updatedAt,

    },

  });

};



/**

 * Update fields on the guest profile linked to the current user.

 */

exports.patchMe = async (req, res) => {

  try {

    const doc = await guestService.updateGuestByUserId(req.user.id, req.body || {});

    if (!doc) {

      return res.status(404).json({ error: "No guest profile linked to this account yet." });

    }

    const shape = guestService.toBillingGuestShape(doc);

    res.json({

      guest: {

        id: doc._id,

        name: shape.name,

        email: shape.email,

        contactNumber: shape.contactNumber,

        displayName: doc.displayName ?? "",

        phone: doc.phone ?? "",

        address: doc.address ?? "",

        profilePhotoData: doc.profilePhotoData ?? "",

        userId: doc.userId ?? null,

        createdAt: doc.createdAt,

        updatedAt: doc.updatedAt,

      },

    });

  } catch (e) {

    const msg = e && e.message ? String(e.message) : "Update failed";

    res.status(400).json({ error: msg });

  }

};


