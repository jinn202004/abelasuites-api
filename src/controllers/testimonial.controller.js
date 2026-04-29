const testimonialService = require("../services/testimonial.service");

exports.list = async (req, res) => {
  const testimonials = await testimonialService.getApprovedTestimonials();
  res.json({ testimonials });
};
