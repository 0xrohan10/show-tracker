import { stmt } from '$lib/server/db';
import { TRACKABLE_TEAMS, ensureDefaultTeamsTracked, refreshAllTeams, refreshTeam as refreshSportsTeam } from '$lib/server/sports';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const bootstrapResults = await ensureDefaultTeamsTracked();
  const games = stmt.upcomingGames.all();
  const teams = stmt.listTeams.all();

  const gameGroupsMap = new Map<string, typeof games>();
  for (const game of games) {
    const key = game.game_date;
    if (!gameGroupsMap.has(key)) gameGroupsMap.set(key, []);
    gameGroupsMap.get(key)!.push(game);
  }
  const gameGroups = Array.from(gameGroupsMap.entries()).map(([date, games]) => ({ date, games }));

  const teamCards = TRACKABLE_TEAMS.map((team) => {
    const trackedTeam = teams.find((t) => t.slug === team.slug);
    const nextGame = trackedTeam ? games.find((game) => game.team_id === trackedTeam.id) : undefined;
    return {
      ...team,
      tracked: Boolean(trackedTeam),
      id: trackedTeam?.id ?? null,
      last_refreshed_at: trackedTeam?.last_refreshed_at ?? null,
      next_game: nextGame ?? null
    };
  });

  return { gameGroups, teams, teamCards, bootstrapResults };
};

export const actions: Actions = {
  refresh: async () => {
    const results = await refreshAllTeams();
    return { refreshed: results };
  },
  refreshTeam: async ({ request }) => {
    const data = await request.formData();
    const teamId = Number(data.get('team_id'));
    if (!teamId) return fail(400, { error: 'missing id' });
    await refreshSportsTeam(teamId);
    return { refreshedTeam: teamId };
  },
  setAttendance: async ({ request }) => {
    const data = await request.formData();
    const teamId = Number(data.get('team_id'));
    const externalId = String(data.get('external_id') || '');
    const attending = String(data.get('attending'));

    if (!teamId || !externalId) return fail(400, { error: 'missing game' });
    if (attending !== '0' && attending !== '1') return fail(400, { error: 'missing attendance' });

    if (attending === '1') {
      stmt.setGameAttendance.run(teamId, externalId, 1);
    } else {
      stmt.clearGameAttendance.run(teamId, externalId);
    }
    return { attendanceSet: { teamId, externalId, attending: Number(attending) } };
  }
};
