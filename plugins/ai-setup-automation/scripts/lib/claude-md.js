'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discoverSkillFiles, discoverAgentFiles } = require('./discovery');

/**
 * Parse skills and agents tables from CLAUDE.md content.
 * Looks for markdown tables containing skill/agent names.
 * Handles two common table structures:
 *   | Skill | Description |    (column header: "Skill", "Command", "Agent", "Name")
 *   | skill-name | ... |
 *
 * Returns: { skills: string[], agents: string[] }
 */
function parseClaudeMdTables(content) {
  const skills = [];
  const agents = [];
  const lines = content.split('\n');

  // State machine: track which table we're in
  let currentTableType = null; // 'skills' | 'agents' | null
  let inTable = false;
  let headerParsed = false;
  let nameColumnIndex = -1;

  // Keywords that identify a table as containing skills or agents
  const skillKeywords = /\bskill\b|\bcommand\b/i;
  const agentKeywords = /\bagent\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Section headings reset table context
    if (/^#{1,4}\s/.test(line)) {
      const heading = line.toLowerCase();
      if (/skill|command/.test(heading)) {
        currentTableType = 'skills';
      } else if (/agent/.test(heading)) {
        currentTableType = 'agents';
      } else {
        currentTableType = null;
      }
      inTable = false;
      headerParsed = false;
      nameColumnIndex = -1;
      continue;
    }

    // Table row detection
    if (line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);

      if (!inTable) {
        // Check if this is a header row with skill/agent column identifiers
        const headerLine = line.toLowerCase();
        if (skillKeywords.test(headerLine) && currentTableType !== 'agents') {
          currentTableType = 'skills';
          inTable = true;
          headerParsed = false;
          // Find the index of the "Skill" / "Command" column
          nameColumnIndex = cells.findIndex(c => /skill|command|name/i.test(c));
          if (nameColumnIndex < 0) nameColumnIndex = 0;
          headerParsed = true;
        } else if (agentKeywords.test(headerLine)) {
          currentTableType = 'agents';
          inTable = true;
          headerParsed = false;
          nameColumnIndex = cells.findIndex(c => /agent|name/i.test(c));
          if (nameColumnIndex < 0) nameColumnIndex = 0;
          headerParsed = true;
        } else if (currentTableType && cells.length >= 2) {
          // Could be the header row of a table in an already-identified section
          inTable = true;
          nameColumnIndex = 0;
          headerParsed = true;
        }
        continue;
      }

      // Skip separator row (|---|---|)
      if (/^[\s|:-]+$/.test(line)) continue;

      // Data row: extract name from the identified column
      if (headerParsed && cells.length > nameColumnIndex) {
        const name = cells[nameColumnIndex]
          .replace(/`/g, '')      // strip backticks
          .replace(/\[([^\]]+)\]\([^)]+\)/, '$1') // strip markdown links
          .trim();

        // Skip empty, header-like, or separator values
        if (!name || /^[-:]+$/.test(name) || /^(skill|agent|command|name)$/i.test(name)) continue;
        // Skip lines that are likely prose not table data
        if (name.length > 80) continue;

        if (currentTableType === 'skills') {
          skills.push(name);
        } else if (currentTableType === 'agents') {
          agents.push(name);
        }
      }
    } else if (inTable && line.trim() === '') {
      // Blank line ends the table
      inTable = false;
      headerParsed = false;
      nameColumnIndex = -1;
    }
  }

  return { skills: [...new Set(skills)], agents: [...new Set(agents)] };
}

/**
 * Compare CLAUDE.md tables against actual files on disk.
 * Returns:
 *   missingFromTable: files on disk not listed in CLAUDE.md
 *   missingFromDisk:  names in CLAUDE.md tables with no file on disk
 *   matched:          names that appear in both
 */
function diffClaudeMdVsDisk(claudeMdContent, projectRoot) {
  const { skills: tableSkills, agents: tableAgents } = parseClaudeMdTables(claudeMdContent);
  const diskSkills = discoverSkillFiles(projectRoot).map(s => s.name);
  const diskAgents = discoverAgentFiles(projectRoot).map(a => a.name);

  const tableSkillSet = new Set(tableSkills);
  const tableAgentSet = new Set(tableAgents);
  const diskSkillSet = new Set(diskSkills);
  const diskAgentSet = new Set(diskAgents);

  const missingFromTable = [
    ...diskSkills.filter(n => !tableSkillSet.has(n)).map(n => ({ type: 'skill', name: n })),
    ...diskAgents.filter(n => !tableAgentSet.has(n)).map(n => ({ type: 'agent', name: n })),
  ];

  const missingFromDisk = [
    ...tableSkills.filter(n => !diskSkillSet.has(n)).map(n => ({ type: 'skill', name: n })),
    ...tableAgents.filter(n => !diskAgentSet.has(n)).map(n => ({ type: 'agent', name: n })),
  ];

  const matched = [
    ...diskSkills.filter(n => tableSkillSet.has(n)).map(n => ({ type: 'skill', name: n })),
    ...diskAgents.filter(n => tableAgentSet.has(n)).map(n => ({ type: 'agent', name: n })),
  ];

  return {
    missingFromTable,
    missingFromDisk,
    matched,
    tableSkills,
    tableAgents,
    diskSkills,
    diskAgents,
  };
}

module.exports = { parseClaudeMdTables, diffClaudeMdVsDisk };
