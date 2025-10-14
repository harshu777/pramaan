import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { logger } from './logger';

/**
 * Seed sample competition data for testing
 * This creates sample athlete competition records that can be used for 5% quota certificate requests
 */
export async function seedCompetitionData(): Promise<void> {
  try {
    // Sample athlete data (should already exist, but we'll create if not)
    const sampleAthletes = [
      {
        id: uuidv4(),
        uniqueId: 'ATH2024001',
        aadharNumber: '123456789012',
        fullName: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        phoneNumber: '9876543210',
        dob: '2000-05-15',
        district: 'Pune',
        state: 'Maharashtra'
      },
      {
        id: uuidv4(),
        uniqueId: 'ATH2024002',
        aadharNumber: '234567890123',
        fullName: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        phoneNumber: '9876543211',
        dob: '2001-08-20',
        district: 'Mumbai',
        state: 'Maharashtra'
      },
      {
        id: uuidv4(),
        uniqueId: 'ATH2024003',
        aadharNumber: '345678901234',
        fullName: 'Amit Patel',
        email: 'amit.patel@example.com',
        phoneNumber: '9876543212',
        dob: '1999-12-10',
        district: 'Nagpur',
        state: 'Maharashtra'
      }
    ];

    // Insert sample athletes if they don't exist
    const bcrypt = require('bcrypt');
    const defaultPassword = await bcrypt.hash('athlete123', 10);

    for (const athlete of sampleAthletes) {
      try {
        await query(
          `INSERT OR IGNORE INTO athletes
           (id, unique_id, aadhar_number, full_name, email, phone_number, dob, district, state, password_hash, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            athlete.id,
            athlete.uniqueId,
            athlete.aadharNumber,
            athlete.fullName,
            athlete.email,
            athlete.phoneNumber,
            athlete.dob,
            athlete.district,
            athlete.state,
            defaultPassword
          ]
        );
        logger.info(`Sample athlete created/verified: ${athlete.fullName}`);
      } catch (err) {
        logger.warn(`Athlete ${athlete.email} may already exist`);
      }
    }

    // Sample competition data
    const competitions = [
      // Rajesh Kumar's competitions
      {
        athleteId: sampleAthletes[0].id,
        uniqueId: sampleAthletes[0].uniqueId,
        aadharNumber: sampleAthletes[0].aadharNumber,
        competitionName: 'Maharashtra State Athletics Championship 2023',
        competitionType: 'Athletics',
        eventName: '100m Sprint',
        position: 1,
        medalType: 'Gold',
        competitionDate: '2023-09-15',
        competitionLevel: 'State',
        organizingBody: 'Maharashtra Athletics Association',
        location: 'Pune, Maharashtra'
      },
      {
        athleteId: sampleAthletes[0].id,
        uniqueId: sampleAthletes[0].uniqueId,
        aadharNumber: sampleAthletes[0].aadharNumber,
        competitionName: 'National Junior Athletics Meet 2023',
        competitionType: 'Athletics',
        eventName: '200m Sprint',
        position: 2,
        medalType: 'Silver',
        competitionDate: '2023-11-20',
        competitionLevel: 'National',
        organizingBody: 'Athletics Federation of India',
        location: 'Delhi, India'
      },
      {
        athleteId: sampleAthletes[0].id,
        uniqueId: sampleAthletes[0].uniqueId,
        aadharNumber: sampleAthletes[0].aadharNumber,
        competitionName: 'Inter-District Athletics Championship 2024',
        competitionType: 'Athletics',
        eventName: '4x100m Relay',
        position: 1,
        medalType: 'Gold',
        competitionDate: '2024-03-10',
        competitionLevel: 'District',
        organizingBody: 'Pune District Sports Association',
        location: 'Pune, Maharashtra'
      },

      // Priya Sharma's competitions
      {
        athleteId: sampleAthletes[1].id,
        uniqueId: sampleAthletes[1].uniqueId,
        aadharNumber: sampleAthletes[1].aadharNumber,
        competitionName: 'Maharashtra State Swimming Championship 2023',
        competitionType: 'Swimming',
        eventName: '100m Freestyle',
        position: 1,
        medalType: 'Gold',
        competitionDate: '2023-08-25',
        competitionLevel: 'State',
        organizingBody: 'Maharashtra Swimming Association',
        location: 'Mumbai, Maharashtra'
      },
      {
        athleteId: sampleAthletes[1].id,
        uniqueId: sampleAthletes[1].uniqueId,
        aadharNumber: sampleAthletes[1].aadharNumber,
        competitionName: 'National Aquatics Championship 2023',
        competitionType: 'Swimming',
        eventName: '200m Butterfly',
        position: 3,
        medalType: 'Bronze',
        competitionDate: '2023-12-05',
        competitionLevel: 'National',
        organizingBody: 'Swimming Federation of India',
        location: 'Bangalore, India'
      },

      // Amit Patel's competitions
      {
        athleteId: sampleAthletes[2].id,
        uniqueId: sampleAthletes[2].uniqueId,
        aadharNumber: sampleAthletes[2].aadharNumber,
        competitionName: 'Maharashtra State Wrestling Championship 2023',
        competitionType: 'Wrestling',
        eventName: '74kg Category',
        position: 2,
        medalType: 'Silver',
        competitionDate: '2023-10-18',
        competitionLevel: 'State',
        organizingBody: 'Maharashtra Wrestling Association',
        location: 'Nagpur, Maharashtra'
      },
      {
        athleteId: sampleAthletes[2].id,
        uniqueId: sampleAthletes[2].uniqueId,
        aadharNumber: sampleAthletes[2].aadharNumber,
        competitionName: 'West Zone Wrestling Tournament 2024',
        competitionType: 'Wrestling',
        eventName: '74kg Category',
        position: 1,
        medalType: 'Gold',
        competitionDate: '2024-02-14',
        competitionLevel: 'Zonal',
        organizingBody: 'Wrestling Federation of India - West Zone',
        location: 'Ahmedabad, Gujarat'
      }
    ];

    // Insert competition records
    for (const comp of competitions) {
      const compId = uuidv4();
      await query(
        `INSERT INTO athlete_competitions
         (id, athlete_id, unique_id, aadhar_number, competition_name, competition_type,
          event_name, position, medal_type, competition_date, competition_level,
          organizing_body, location, certificate_issued)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          compId,
          comp.athleteId,
          comp.uniqueId,
          comp.aadharNumber,
          comp.competitionName,
          comp.competitionType,
          comp.eventName,
          comp.position,
          comp.medalType,
          comp.competitionDate,
          comp.competitionLevel,
          comp.organizingBody,
          comp.location
        ]
      );
    }

    logger.info(`Successfully seeded ${competitions.length} competition records for ${sampleAthletes.length} athletes`);
    logger.info('Sample athlete login credentials:');
    sampleAthletes.forEach(athlete => {
      logger.info(`  Email: ${athlete.email}, Password: athlete123, Unique ID: ${athlete.uniqueId}, Aadhar: ${athlete.aadharNumber}`);
    });

  } catch (error) {
    logger.error('Error seeding competition data:', error);
    throw error;
  }
}
