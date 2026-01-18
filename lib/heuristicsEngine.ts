import type {
  HeuristicRecommendation,
  HeuristicsInput,
  ReadmeInputs,
  GitHubRepoNormalized
} from '../types'

/**
 * V2.1 Heuristics Engine
 *
 * Generates opinionated recommendations based on:
 * - User inputs (career stage, role, goals, tone)
 * - GitHub inspection data (if available)
 *
 * Rules:
 * - 100% deterministic (no AI)
 * - Returns recommendations only, never actions
 * - All recommendations are explainable
 * - User can ignore everything
 */

const RECENT_DAYS_THRESHOLD = 180 // 6 months
const STRONG_REPO_STAR_THRESHOLD = 5
const HIGH_STAR_THRESHOLD = 50

/**
 * Main entry point: generates all heuristic recommendations
 */
export function generateHeuristicRecommendations(input: HeuristicsInput): HeuristicRecommendation[] {
  const recommendations: HeuristicRecommendation[] = []

  const { userInputs, githubData } = input

  // Section recommendations
  recommendations.push(...generateSectionRecommendations(userInputs, githubData))

  // Tone recommendations
  recommendations.push(...generateToneRecommendations(userInputs, githubData))

  // Warning signals
  recommendations.push(...generateWarnings(userInputs, githubData))

  return recommendations
}

/**
 * Section Recommendations
 * Suggests enabling/disabling sections based on data quality
 */
function generateSectionRecommendations(
  userInputs: ReadmeInputs,
  githubData: HeuristicsInput['githubData']
): HeuristicRecommendation[] {
  const recs: HeuristicRecommendation[] = []

  if (githubData) {
    // No active repos → recommend disabling Projects section
    if (githubData.repoCount === 0 || (!githubData.hasRecentActivity && githubData.topRepos.length === 0)) {
      if (userInputs.sections.projects) {
        recs.push({
          recommendationType: 'section',
          message: 'Consider hiding the Featured Projects section',
          explanation: 'Your GitHub profile shows no active repositories. A projects section without content may weaken your profile.',
          suggestedAction: {
            type: 'disable',
            target: 'projects',
            value: false
          }
        })
      }
    }

    // 3+ strong repos → recommend enabling Featured Projects
    const strongRepos = githubData.topRepos.filter((r) => r.stars >= STRONG_REPO_STAR_THRESHOLD)
    if (strongRepos.length >= 3 && !userInputs.sections.projects) {
      recs.push({
        recommendationType: 'section',
        message: 'Consider enabling the Featured Projects section',
        explanation: `You have ${strongRepos.length} repositories with ${STRONG_REPO_STAR_THRESHOLD}+ stars. Showcasing these could strengthen your profile.`,
        suggestedAction: {
          type: 'enable',
          target: 'projects',
          value: true
        }
      })
    }

    // No detected languages → recommend manual tech stack
    if (githubData.primaryLanguages.length === 0) {
      if (!userInputs.sections.techStack) {
        recs.push({
          recommendationType: 'section',
          message: 'Consider adding a Tech Stack section manually',
          explanation: 'No programming languages were detected from your repositories. Adding your skills manually will help visitors understand your expertise.',
          suggestedAction: {
            type: 'enable',
            target: 'techStack',
            value: true
          }
        })
      }
    }

    // Has languages but tech stack is empty → suggest populating it
    if (githubData.primaryLanguages.length > 0 && userInputs.techStack.length === 0) {
      recs.push({
        recommendationType: 'section',
        message: 'Your tech stack is empty but we detected languages',
        explanation: `Languages like ${githubData.primaryLanguages.slice(0, 3).join(', ')} were found in your repos. Consider adding them to your tech stack.`,
        suggestedAction: {
          type: 'change',
          target: 'techStack',
          value: githubData.primaryLanguages.slice(0, 5)
        }
      })
    }
  }

  // No GitHub data scenarios
  if (!githubData) {
    // If user has projects section enabled but no featured projects
    if (userInputs.sections.projects && userInputs.featuredProjects.length === 0) {
      recs.push({
        recommendationType: 'section',
        message: 'Add featured projects or hide the section',
        explanation: 'The Featured Projects section is enabled but empty. Either add projects manually or consider hiding this section.',
        suggestedAction: {
          type: 'disable',
          target: 'projects',
          value: false
        }
      })
    }

    // If tech stack is enabled but empty
    if (userInputs.sections.techStack && userInputs.techStack.length === 0) {
      recs.push({
        recommendationType: 'section',
        message: 'Add technologies to your tech stack',
        explanation: 'The Tech Stack section is enabled but empty. Add your skills to help visitors understand your expertise.'
      })
    }
  }

  return recs
}

/**
 * Tone Recommendations
 * Suggests tone adjustments based on career stage and activity
 */
function generateToneRecommendations(
  userInputs: ReadmeInputs,
  githubData: HeuristicsInput['githubData']
): HeuristicRecommendation[] {
  const recs: HeuristicRecommendation[] = []

  const { careerStage, profileGoal, tone } = userInputs

  // Student + low/no activity → suggest friendly/learning-focused tone
  if (careerStage === 'student') {
    if (!githubData || !githubData.hasRecentActivity) {
      if (tone !== 'friendly') {
        recs.push({
          recommendationType: 'tone',
          message: 'Consider a friendly, learning-focused tone',
          explanation: 'As a student with limited visible activity, a friendly tone emphasizing learning and growth can be more authentic and engaging.',
          suggestedAction: {
            type: 'change',
            target: 'tone',
            value: 'friendly'
          }
        })
      }
    }
  }

  // High stars + recent activity → suggest confident/impact-focused tone
  if (githubData && githubData.totalStars >= HIGH_STAR_THRESHOLD && githubData.hasRecentActivity) {
    if (tone === 'minimal' || tone === 'friendly') {
      recs.push({
        recommendationType: 'tone',
        message: 'Consider a more confident tone',
        explanation: `Your projects have ${githubData.totalStars} total stars and recent activity. A confident tone can better reflect your impact.`,
        suggestedAction: {
          type: 'change',
          target: 'tone',
          value: 'confident'
        }
      })
    }
  }

  // Open-source goal → suggest community-oriented tone
  if (profileGoal === 'open-source') {
    if (tone === 'minimal') {
      recs.push({
        recommendationType: 'tone',
        message: 'Consider a friendlier tone for open-source',
        explanation: 'Open-source contributions benefit from an approachable, community-focused tone that invites collaboration.',
        suggestedAction: {
          type: 'change',
          target: 'tone',
          value: 'friendly'
        }
      })
    }
  }

  // Founder career stage → suggest founder tone if not already
  if (careerStage === 'founder' && tone !== 'founder') {
    recs.push({
      recommendationType: 'tone',
      message: 'Consider using the founder tone',
      explanation: 'The founder tone is designed to emphasize vision and leadership, which aligns with your career stage.',
      suggestedAction: {
        type: 'change',
        target: 'tone',
        value: 'founder'
      }
    })
  }

  // Job goal + professional → suggest confident tone
  if (profileGoal === 'job' && careerStage === 'professional' && tone !== 'confident') {
    recs.push({
      recommendationType: 'tone',
      message: 'Consider a confident tone for job searching',
      explanation: 'When looking for roles, a confident tone helps communicate your value proposition clearly to potential employers.',
      suggestedAction: {
        type: 'change',
        target: 'tone',
        value: 'confident'
      }
    })
  }

  return recs
}

/**
 * Warning Signals
 * Non-judgmental observations that may affect profile quality
 */
function generateWarnings(
  userInputs: ReadmeInputs,
  githubData: HeuristicsInput['githubData']
): HeuristicRecommendation[] {
  const recs: HeuristicRecommendation[] = []

  if (githubData) {
    // Low recent activity warning
    if (!githubData.hasRecentActivity && githubData.repoCount > 0) {
      recs.push({
        recommendationType: 'warning',
        message: 'Your profile shows limited recent activity',
        explanation: 'Most of your repositories haven\'t been updated in the last 6 months. Consider focusing your bio on skills and experience rather than active projects.'
      })
    }

    // High fork ratio warning
    if (githubData.forkRatio > 0.7 && githubData.repoCount > 2) {
      recs.push({
        recommendationType: 'warning',
        message: 'Most of your repositories appear to be forks',
        explanation: 'Featuring forked repositories may not showcase your original work effectively. Consider highlighting your own projects instead.'
      })
    }

    // No stars on any repo
    if (githubData.totalStars === 0 && githubData.repoCount > 0) {
      recs.push({
        recommendationType: 'warning',
        message: 'Your repositories haven\'t received stars yet',
        explanation: 'This is normal for newer profiles. Focus on describing the problems your projects solve rather than metrics.'
      })
    }

    // Very few repos
    if (githubData.repoCount > 0 && githubData.repoCount < 3) {
      recs.push({
        recommendationType: 'warning',
        message: 'You have a small number of public repositories',
        explanation: 'With fewer projects to showcase, consider writing detailed descriptions for each one to maximize their impact.'
      })
    }
  }

  // Profile completeness warnings (no GitHub needed)
  if (!userInputs.role || userInputs.role.trim() === '') {
    recs.push({
      recommendationType: 'warning',
      message: 'Your primary role is not specified',
      explanation: 'Adding a clear role helps visitors quickly understand what you do.'
    })
  }

  if (userInputs.name === 'Your Name' || userInputs.name.trim() === '') {
    recs.push({
      recommendationType: 'warning',
      message: 'Remember to add your real name',
      explanation: 'A personalized name makes your profile more authentic and memorable.'
    })
  }

  return recs
}

/**
 * Helper to check if repos have recent activity
 */
export function hasRecentActivity(repos: GitHubRepoNormalized[]): boolean {
  const now = Date.now()
  return repos.some((r) => {
    const updated = new Date(r.lastUpdated).getTime()
    const daysSince = (now - updated) / (1000 * 60 * 60 * 24)
    return daysSince <= RECENT_DAYS_THRESHOLD
  })
}

/**
 * Helper to calculate total stars
 */
export function calculateTotalStars(repos: GitHubRepoNormalized[]): number {
  return repos.reduce((sum, r) => sum + r.stars, 0)
}
