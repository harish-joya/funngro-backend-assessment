
async function getMonthlyReport(startDate, endDate) {

  const report = await PointLedger.aggregate([

    // Get records for the selected month
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lt: endDate
        },
        type: {
          $in: ["earned", "converted", "expired"]
        }
      }
    },

    // Group records by user
    {
      $group: {
        _id: {
          userId: "$userId",
          cohort: "$cohort"
        },

        pointsEarned: {
          $sum: {
            $cond: [
              { $eq: ["$type", "earned"] },
              "$points",
              0
            ]
          }
        },

        pointsConverted: {
          $sum: {
            $cond: [
              { $eq: ["$type", "converted"] },
              "$points",
              0
            ]
          }
        },

        pointsExpired: {
          $sum: {
            $cond: [
              { $eq: ["$type", "expired"] },
              "$points",
              0
            ]
          }
        }
      }
    },

    // Show the final report in a readable format
    {
      $project: {
        _id: 0,
        userId: "$_id.userId",
        cohort: "$_id.cohort",
        pointsEarned: 1,
        pointsConverted: 1,
        pointsExpired: 1
      }
    },

    // Sort by user ID
    {
      $sort: {
        userId: 1
      }
    }

  ]);

  return report;
}

module.exports = getMonthlyReport;
