import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const certificateSchema = Joi.object({
  issuerDid: Joi.string().required(),
  issuerName: Joi.string().required(),
  subjectDid: Joi.string().optional().allow(''),
  subjectName: Joi.string().required(),
  subjectEmail: Joi.string().email().optional().allow(''),
  certificateType: Joi.string().required(),
  expiryDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null)
  ).optional(),
  metadata: Joi.object().optional(),
}).unknown(true); // Allow additional fields

const searchSchema = Joi.object({
  q: Joi.string().min(3).required(),
});

export function validateCertificateInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { error } = certificateSchema.validate(req.body);

  if (error) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details.map(d => d.message),
    });
    return;
  }

  next();
}

export function validateSearchInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow empty search query
  if (!req.query.q || req.query.q === '') {
    req.query.q = '';
  }

  next();
}