import { Router, Request, Response } from 'express';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get report by Game Code
router.get('/game-wise', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const result = await query(`
    SELECT
      game_code,
      game_name,
      COUNT(*) as total_records,
      SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) as certificates_issued,
      SUM(CASE WHEN certificate_requested = 1 THEN 1 ELSE 0 END) as certificates_requested,
      COUNT(DISTINCT athlete_id) as unique_athletes
    FROM athlete_competitions
    WHERE game_code IS NOT NULL AND game_code != ''
    GROUP BY game_code, game_name
    ORDER BY total_records DESC
  `, []);

  res.json({
    success: true,
    report: result.rows,
    totalGames: result.rows.length
  });
}));

// Get report by Age Group Code
router.get('/age-wise', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const result = await query(`
    SELECT
      age_group_code,
      COUNT(*) as total_records,
      SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) as certificates_issued,
      SUM(CASE WHEN certificate_requested = 1 THEN 1 ELSE 0 END) as certificates_requested,
      COUNT(DISTINCT athlete_id) as unique_athletes
    FROM athlete_competitions
    WHERE age_group_code IS NOT NULL AND age_group_code != ''
    GROUP BY age_group_code
    ORDER BY total_records DESC
  `, []);

  res.json({
    success: true,
    report: result.rows,
    totalAgeGroups: result.rows.length
  });
}));

// Get report by Gender Code
router.get('/gender-wise', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const result = await query(`
    SELECT
      gender_code,
      CASE
        WHEN gender_code = 'M' THEN 'Male'
        WHEN gender_code = 'F' THEN 'Female'
        WHEN gender_code = 'O' THEN 'Other'
        ELSE gender_code
      END as gender_name,
      COUNT(*) as total_records,
      SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) as certificates_issued,
      SUM(CASE WHEN certificate_requested = 1 THEN 1 ELSE 0 END) as certificates_requested,
      COUNT(DISTINCT athlete_id) as unique_athletes
    FROM athlete_competitions
    WHERE gender_code IS NOT NULL AND gender_code != ''
    GROUP BY gender_code
    ORDER BY total_records DESC
  `, []);

  res.json({
    success: true,
    report: result.rows,
    totalGenders: result.rows.length
  });
}));

// Get summary report (all combined)
router.get('/summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  // Get overall statistics
  const overallStats = await query(`
    SELECT
      COUNT(*) as total_records,
      SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) as certificates_issued,
      SUM(CASE WHEN certificate_requested = 1 THEN 1 ELSE 0 END) as certificates_requested,
      COUNT(DISTINCT athlete_id) as unique_athletes,
      COUNT(DISTINCT game_code) as unique_games,
      COUNT(DISTINCT age_group_code) as unique_age_groups,
      COUNT(DISTINCT gender_code) as unique_genders
    FROM athlete_competitions
  `, []);

  res.json({
    success: true,
    summary: overallStats.rows[0]
  });
}));

// Get detailed records by filter
router.get('/details', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const { gameCode, ageGroupCode, genderCode } = req.query;

  let queryStr = `
    SELECT
      ac.*,
      a.full_name as linked_athlete_name,
      a.email as linked_athlete_email
    FROM athlete_competitions ac
    LEFT JOIN athletes a ON ac.athlete_id = a.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (gameCode) {
    queryStr += ' AND ac.game_code = ?';
    params.push(gameCode);
  }

  if (ageGroupCode) {
    queryStr += ' AND ac.age_group_code = ?';
    params.push(ageGroupCode);
  }

  if (genderCode) {
    queryStr += ' AND ac.gender_code = ?';
    params.push(genderCode);
  }

  queryStr += ' ORDER BY ac.created_at DESC LIMIT 500';

  const result = await query(queryStr, params);

  res.json({
    success: true,
    records: result.rows,
    count: result.rows.length
  });
}));

export default router;
