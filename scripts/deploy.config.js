/**
 * Deploy config: projects in sources/ and their destination path in public/.
 * The deploy script reads this file, runs build in each sources/<source>/,
 * and copies the result to <dest>/.
 *
 * - source: folder name inside sources/
 * - dest: path relative to repo root where build output is copied (from dist/)
 * - copyFrom: (optional) array of folder names inside the project whose
 *   contents are also copied to <dest>/ (in addition to dist/). E.g. ['html']
 */
module.exports = [
  { source: 'electronic-thumb', dest: 'public/widgets/electronic-thumb', copyFrom: ['html'] },
  // Add more projects as they are created in sources/:
  // { source: 'my-script', dest: 'public/js/bundles' },
  // { source: 'other-app', dest: 'public/apps/other-app', copyFrom: ['static'] },
]
