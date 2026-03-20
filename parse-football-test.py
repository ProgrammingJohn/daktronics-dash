s = "12:00HOME      GUEST     2233146311<>403339"

class SportsPresets:
    basketball_preset = {
        'home_score': 0,
        'away_score': 0,
        'home_fouls': 0,
        'away_fouls': 0,
        'home_bonus': False,
        'away_bonus': False,
        'home_timeouts': 5,
        'away_timeouts': 5,
        'period': 1,
        'main_clock': '0:00'
    }
    baseball_preset = {
        'home_score': 0,
        'away_score': 0,
        'inning_text': 'top 1',
        'strikes_and_balls': '0 - 0',
        'out_text': '0 outs',
        'base_one': False,
        'base_two': False,
        'base_three': False,
    }
    football_preset = {
        'home_score': 0,
        'away_score': 0,
        'clock': {'minutes': '00', 'seconds': '00'},
        'period': 1,
        'down': 1,
        'yards': 10,
        'home_timeouts': 3,
        'away_timeouts': 3,
        'home_possesion': True
    }

def safe_parse(string: str, default: str, start_index: int, end_index: int = None):
    if not end_index:
        end_index = start_index + 1
    try:
        return string[start_index : end_index].strip()
    except:
        return default


def parse_football(rtd):
    print(rtd)
    # parts = rtd.split(',')
    sport = SportsPresets.football_preset
    
    clock = safe_parse(rtd, {'minutes': '00', 'seconds': '00'}, 0, 5)
    try:
        clock = {'minutes': clock.split(':')[0], 'seconds': clock.split(':')[1]}
    except:
        clock = {'minutes': '00', 'seconds': '00'}
    home_score = safe_parse(rtd, sport['home_score'], 25, 27)
    away_score = safe_parse(rtd, sport['away_score'], 27, 29)
    period = safe_parse(rtd, sport['period'], 29, 30)
    down = safe_parse(rtd, sport['down'], 32, 33)
    yards = safe_parse(rtd, sport['yards'], 33, 35)
    home_timeouts = safe_parse(rtd, sport['home_timeouts'], 39, 40)
    away_timeouts = safe_parse(rtd, sport['away_timeouts'], 40, 41)
    home_possesion = safe_parse(rtd, sport['home_possesion'], 36, 37)

    # clock = rtd[0:5].strip()
    # home_score = rtd[25:27].strip()
    # away_score = rtd[27:29].strip()
    # period = rtd[29:30].strip()
    # down = rtd[32:33].strip()
    # yards = rtd[33:35].strip()
    # home_timeouts = rtd[39:40].strip()
    # away_timeouts = rtd[40:41].strip()
    # home_possesion = rtd[36:37].strip()
    print(clock, home_score, away_score, period, down, yards, home_timeouts, away_timeouts, home_possesion)


    return {
        'clock': clock,
        'home_score': home_score,
        'away_score': away_score,
        'period': period,
        'down': down,
        'yards': yards,
        'home_timeouts': home_timeouts,
        'away_timeouts': away_timeouts,
        'home_possesion': home_possesion
    }
    # return {
    #     'clock': clock or SportsPresets.football_preset['clock'],
    #     'home_score': home_score or SportsPresets.football_preset['home_score'],
    #     'away_score': away_score or SportsPresets.football_preset['away_score'],
    #     'period': int(period) if period else SportsPresets.football_preset['period'],
    #     'down': int(down) if down else SportsPresets.football_preset['down'],
    #     'yards_to_go': int(yards) if yards else SportsPresets.football_preset['yards_to_go'],
    #     'home_timeouts': int(home_timeouts) if home_timeouts else SportsPresets.football_preset['home_timeouts'],
    #     'away_timeouts': int(away_timeouts) if away_timeouts else SportsPresets.football_preset['away_timeouts'],
    #     'home_possesion': True if home_possesion == ">" else SportsPresets.football_preset['home_possesion']
    # }

if __name__ == "__main__":
    print(parse_football(s))