// https://api.chess.com/pub/player/raffael_chess/stats
// https://api.chess.com/pub/player/raffael_chess/games/2024/08


/*

A. Troca nome de usuário

    - atualiza MODELO.partidas [refreshModel()]
    - busca formulário preenchido no localStorage para usuário
    - se localStorage.timeClass -> seleciona timeClass ...


B. Troca controle de tempo

    - atualiza <select> com lista de partidas filtrado por time class
    - se localStorage.firstGame -> seleciona firstGame

C. Troca primeira partida

    - recalcular tabela


*/



DRAW_STR = new Set(["repetition", "agreed", "insufficient", "timevsinsufficient"])


// helper that wraps $.getJSON in a Promise
function getJson(url) {
    return new Promise((resolve, reject) => {
        $.getJSON(url)
        .done(data => resolve(data))
        .fail((jqXHR, textStatus, errorThrown) => {
            console.error('Error fetching', url, textStatus);
            reject(errorThrown);
        });
    });
}

function cacheKey(key) {
    return "_cache|" + key
}

function getSession(key) {
    return sessionStorage[cacheKey(key)] ? JSON.parse(sessionStorage[cacheKey(key)]) : undefined
}

function putSession(key, value) {
    try {
        sessionStorage[cacheKey(key)] = JSON.stringify(value)
        return value
    } catch(e) {
        console.warn("Erro ao salvar dados no cache (" + key + ")", e)
    }
}

function getLocalCache(key) {
    return localStorage[cacheKey(key)] ? JSON.parse(localStorage[cacheKey(key)]) : undefined
}

function putLocalCache(key, value) {
    try {
        localStorage[cacheKey(key)] = JSON.stringify(value)
        return value
    } catch(e) {
        console.warn("Erro ao salvar dados no cache (" + key + ")", e)
    }
}

function parseRawGameData(rawData, currentUserName) {

    const ret = []

    games = rawData.games.filter(function(e) {
        return e.rated
    })

    games.forEach(e => {
        v = {}
        v.end_time = e.end_time
        v.uuid = e.uuid        
        v.time_class = e.time_class
        v.time_control = e.time_control
        v.color = e.white["@id"].toLowerCase().indexOf(currentUserName.toLowerCase()) >= 0 ? "white" : "black"
        v.opponent = e[v.color == "white" ? "black" : "white"]["@id"].split("/").pop()
        v.rating = e[v.color].rating
        result_str = e[v.color].result
        v.result = result_str == "win" ? 1 : (DRAW_STR.has(result_str) ? 0.5 : 0)
        ret.push(v)

    });

    return ret       

}

async function loadPlayerData(playerUserName) {

    UNCACHED_MONTHS_COUNT = 2
    const p_archives = await getJson("https://api.chess.com/pub/player/" + playerUserName + "/games/archives")

    // não recarrego lista de jogos com mais de 6 meses se estiverem no cache
    let d = new Date()
    let six_months_ago_url = "https://api.chess.com/pub/player/" + playerUserName + "/games/" + d.getFullYear() + ((d.getMonth() + 1 - UNCACHED_MONTHS_COUNT) < 10 ? "/0" : "/") + (d.getMonth() + 1 - UNCACHED_MONTHS_COUNT)

    let allGames = []

    while (p_archives["archives"].length) { 

        let url = p_archives["archives"].pop()

        // FIXME: remover
        if (url.indexOf("/2025") < 0) continue

        let gamesData = undefined

        if (url <= six_months_ago_url) {
            // buscar no cache
            gamesData = getLocalCache(url)
            if (!gamesData) {
                console.log("## não cacheado [1]: " + url)
                rawData = await getJson(url)
                gamesData = putLocalCache(url, parseRawGameData(rawData, playerUserName))
            }
        } else {
            console.log("## não cacheado [2]: " + url)
            gamesData = parseRawGameData(await getJson(url), playerUserName)
        }

        allGames.push(...gamesData)

    }

    allGames.sort((a, b) => a.end_time - b.end_time)
    return Promise.resolve(allGames)

}

// função que faz refresh da lista de jogos
async function refreshModel() {

    player = currentPlayer()
    allGames = await loadPlayerData(player)
    sessionStorage["games"] = JSON.stringify(allGames)
    
    console.log("Atualizado modelo com " + allGames.length + " partidas")

}


function saveForm(player) {

    key = "form|" + player

    data = {}
    data.ctrl_time_class = $("ctrl_time_class").val() ? $("ctrl_time_class").val() : undefined
    data.ctrl_base_match = $("ctrl_base_match").val() ? $("ctrl_base_match").val() : undefined

    putLocalCache(key, data)

}




function ctrl_player_OnChange() {

    refreshModel()

    key = "form|" + player
    data = getLocalCache(key)

    if (data) {
        if (data.ctrl_time_class) {
            $("ctrl_time_class").val(data.ctrl_time_class)
        }

        /*
        if (data.ctrl_base_match) {
            $("ctrl_base_match").val(data.ctrl_base_match)
        }
        */

    }
}







BASE_MONTH = "baseMonth"
USER_NAME = "username"
TIME_CLASS = "timeClass"
BASE_MATCH = "baseMatch"

TIME_CONTROLS = {
    "180+1": "Blitz 3 min + 1",
    "180": "Blitz 3 min",
    "300": "Blitz 5 minutos",
    "600": "Rápida 10 minutos",
    "60": "Bullet 1 minuto"
}


matches = []


async function fetchURLs(urls) {
  const results = [];



  // perform requests one by one (sequentially)
  for (const url of urls) {
    const data = await getJson(url);
    results.push(data);
  }

  return results;
}

function currentPlayer() {
    return $("#ctrl_player").val()
}

function loadValues() {
    names = [BASE_MONTH, USER_NAME, TIME_CLASS, BASE_MATCH]
    for (const e of names) {
        if (localStorage[e]) {
            $('#' + e).val(localStorage[e])
            // $('#' + e).change()
        }
    }
    console.log("loadValues()")
    console.log(localStorage)
}

function saveValue() {
    console.log("saveValue()")
    srcId = this.id
    localStorage[srcId] = $('#' + srcId).val()
    console.log(localStorage)
}

function loadMatches() {
    
}

$( document ).ready( function() {

    $("#ctrl_player").on("change", ctrl_player_OnChange)
    // $("#baseMonth").on("change", saveValue)
    // $("#timeClass").on("change", saveValue)
    // $("#baseMatch").on("change", saveValue)

    // preenchendo os meses de referência
    curMonth = (new Date()).getMonth() + 1
    curYear = (new Date()).getYear() + 1900
    ctrl = $("#baseMonth")
    
    for (let i = 0; i < 12; i++) {
        v = curYear + "/" + (curMonth < 10 ? "0" : "") + curMonth
        s = curMonth + "/" + curYear
        ctrl.append($("<option />").val(v).text(s));
        curMonth -= 1
        if (curMonth == 0) {
            curMonth = 12
            curYear -= 1
        }
    }
    

    loadValues()
})

function baseDate() {
    return new Date($('#baseMonth').val() + "/01")
}

/*
*/
games = null

async function getInfo() {

    // todos_jogos = "https://api.chess.com/pub/player/" + sUserName + "/games/archives"
    // stats_url = "https://api.chess.com/pub/player/" + sUserName + "/stats"

    // data atual
    vBaseDate = [baseDate().getMonth() + 1, baseDate().getYear() + 1900]
    vCurDate = [(new Date()).getMonth() + 1, (new Date()).getYear() + 1900]
    currentUserName = currentUser()

    // lista de datas a buscar, de base date até data atual no formato [mês, ano]
    games_urls = []

    while(true) {
        games_urls.push("https://api.chess.com/pub/player/" + currentUserName + "/games/" + vBaseDate[1] + "/" + (vBaseDate[0] < 10 ? "0" : "") + vBaseDate[0])

        if (JSON.stringify(vBaseDate) == JSON.stringify(vCurDate)) break

        if (vBaseDate[0] < 12) {
            vBaseDate[0] += 1
        } else {
            vBaseDate[0] = 1
            vBaseDate[1] += 1
        }
    }

    return (fetchURLs(games_urls))

}

async function updateOptions() {

    const infos = await getInfo()
    const allResults = []

    for (data of infos) {

        games = data.games.filter(function(e) {
            return e.rated
                // && e.time_control == "600"
                // && e.time_class == time_class
                && (e.end_time * 1000) >= baseDate().getTime()
        })

        games.forEach(e => {
            v = {}
            v.uuid = e.uuid
            v.time_class = e.time_class
            v.time_control = e.time_control
            v.color = e.white["@id"].toLowerCase().indexOf(currentUser().toLowerCase()) > 0 ? "white" : "black"
            v.opponent = e[v.color == "white" ? "black" : "white"]["@id"].split("/").pop()
            v.rating = e[v.color].rating
            result_str = e[v.color].result
            v.result = result_str == "win" ? 1 : (result_str == "draw" ? 0.5 : 0)
            
            if (e.tournament && e.tournament.indexOf("/") >= 0) {
                v.tournament = e.tournament.split("/").pop()
            }

            allResults.push(v)

        });

      
        
    }

    return allResults    
 
}
