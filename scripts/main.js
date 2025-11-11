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



[events, html controls]
REFRESH_HTML_CONTROLS -> onChange dos controles HTML

[modelo]
getValidGames


[servidor remoto]
loadPlayerData(playerUserName) -> carrega dados de URLs ou do localStorage (cache)
parseRawGameData(rawData, currentUserName) -> helper para "limpar" dados antes de guardar no cache

[cache]
putLocalStorage / getLocalStorage -> abstração para local storage
putSessionStorage / getSessionStorage -> abstração para session storage



*/

const DATE_TIME_FMT = new Intl.DateTimeFormat(navigator.language, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});


USER_NAME = "ctrl_player"
TIME_CLASS = "ctrl_time_class"
BASE_MONTH = "ctrl_base_month"
BASE_MATCH = "ctrl_base_match"

TIME_CONTROLS = {
    "180+1": "Blitz 3 min + 1",
    "180": "Blitz 3 min",
    "300": "Blitz 5 minutos",
    "600": "Rápida 10 minutos",
    "60": "Bullet 1 minuto"
}

// tipos de empate
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

function getSessionStorage(key) {
    return sessionStorage[cacheKey(key)] ? JSON.parse(sessionStorage[cacheKey(key)]) : undefined
}

function putSessionStorage(key, value) {
    try {
        sessionStorage[cacheKey(key)] = JSON.stringify(value)
        return value
    } catch(e) {
        console.warn("Erro ao salvar dados no cache (" + key + ")", e)
    }
}

function getLocalStorage(key) {
    return localStorage[cacheKey(key)] ? JSON.parse(localStorage[cacheKey(key)]) : undefined
}

function putLocalStorage(key, value) {
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

    f= false

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
        let gameDataCacheKey = "games://" + url

        // FIXME: remover
        if (url.indexOf("/2025") < 0) continue

        let gamesData = undefined

        if (url <= six_months_ago_url) {
            // buscar no cache
            gamesData = getLocalStorage(gameDataCacheKey)
            if (!gamesData) {
                console.log("## não cacheado [1]: " + url)
                rawData = await getJson(url)
                gamesData = putLocalStorage(gameDataCacheKey, parseRawGameData(rawData, playerUserName))
            }
        } else {
            console.log("## não cacheado [url recente]: " + url)
            gamesData = parseRawGameData(await getJson(url), playerUserName)
        }

        allGames.push(...gamesData)

    }

    allGames.sort((a, b) => a.end_time - b.end_time)
    return Promise.resolve(allGames)

}

// refreshes playeName's game list and save on sessionStorage
async function refreshModel(playerName) {

    allGames = await loadPlayerData(playerName)
    putSessionStorage("games", allGames)
    console.log("Atualizado modelo com " + allGames.length + " partidas")

}


function saveForm(player) {

    key = "form|" + player

    data = {}
    data.ctrl_time_class = $("ctrl_time_class").val() ? $("ctrl_time_class").val() : undefined
    data.ctrl_base_match = $("ctrl_base_match").val() ? $("ctrl_base_match").val() : undefined

    putLocalCache(key, data)

}






function clearAll() {
    localStorage.clear()
    sessionStorage.clear()
    console.info("Tudo limpo!")
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
}

function saveValue() {
    srcId = this.id
    localStorage[srcId] = $('#' + srcId).val()
}

function loadMatches() {
    
}

async function getValidGames(playerName, timeClass, baseStartTime) {
    console.log(`getValidGames(${playerName}, ${timeClass}, ${baseStartTime})`)
    await refreshModel(playerName)
    allGames = getSessionStorage("games")
    console.log(`Recuperado do sessionStorage ${allGames.length} jogos`)
    validGames = allGames.filter(e => e.end_time >= baseStartTime && e.time_class == timeClass)
    return validGames
}

REFRESH_HTML_CONTROLS = async function(e) {

    /*
    ctrl_player
    ctrl_time_class
    ctrl_base_month
    ctrl_base_match
    */

    // id e valor do controle acionado
    srcId = (e.currentTarget.id)
    srcValue = (e.currentTarget.value)

    level = [USER_NAME, TIME_CLASS, BASE_MONTH, BASE_MATCH].indexOf(srcId)

    console.log("Alterando controle " + srcId + " para valor " + srcValue + " (level:" + level + ")")

    if (level < 0) {
        console.error("Controle " + srcId + " não identificado!")
        return
    }

    playerName = $("#" + USER_NAME).val()    
    timeClass = $("#" + TIME_CLASS).val()    
    baseMonth = $("#" + BASE_MONTH).val()    
    baseGame = $("#" + BASE_MATCH).val()    

    if (!playerName) {
        console.info("Nenhum usuário selecionado!")
        return
    }

    $("#loading-indicator").show()    

    // player
    if (level == 0) {
        
        console.log("Limpar partida de referência")     
        $("#" + BASE_MATCH + " option:selected").prop('selected', false);   
        
        console.log(`--> Carregar partidas de ${playerName}`)

        validGames = await getValidGames(playerName, timeClass, baseMonth)
        options = {}
        validGames.forEach(game => {
            sDt = DATE_TIME_FMT.format(game.end_time * 1000)
            options[game.uuid] = `${sDt} - ${game.opponent} (${game.rating}, ${game.result == 1 ? 'win' : (game.result == 0 ? 'loss' : 'draw')})`
        })
        setSelectOptions($(`#${BASE_MATCH}`), options)

        console.log(`--> ${validGames.length} partidas válidas!`)

        console.log("Carregar partidas filtradas por mês base e tipo de controle de tempo em partida de referência")
        console.log("se P=playerName/sessionStorage/<tipo partida>/<mes base>, e partida referencia existe, selecionar partida de referência P")

        
    }

    // tipo de partida
    if (level == 1) {
        console.log("Limpar partida de referência")        
        console.log("Carregar partidas de " + playerName)
        console.log("Carregar partidas filtradas por mês base e tipo de controle de tempo em partida de referência")
        console.log("se P=playerName/sessionStorage/<tipo partida>/<mes base>, e partida referencia existe, selecionar partida de referência P")
    }

    // mês base
    if (level == 2) {
        console.log("Limpar partida de referência")        
        console.log("Carregar partidas de " + playerName)
        console.log("Carregar partidas filtradas por mês base e tipo de controle de tempo em partida de referência")
        console.log("se P=playerName/sessionStorage/<tipo partida>/<mes base>, e partida referencia existe, selecionar partida de referência P")
    }


    if (level == 3) {
        console.log("salvar P=playerName/sessionStorage/<tipo partida>/<mes base>")
    }


    $("#loading-indicator").hide()


}

function setSelectOptions(ctrl, options) {
    ctrl.empty()
    for (const [k, v] of Object.entries(options)) {
            ctrl.append($("<option />").val(k).text(v))
    }
}

$( document ).ready( function() {

    // on change dos controles
    [USER_NAME, TIME_CLASS, BASE_MONTH, BASE_MATCH].forEach(id => $("#" + id).on("change", REFRESH_HTML_CONTROLS))

    $("#btnClear").on("click", clearAll)
    $("#loading-indicator").hide()
    
    

    // preenchendo os meses de referência
    curMonth = (new Date()).getMonth() + 1
    curYear = (new Date()).getFullYear()
    ctrl = $("#ctrl_base_month")
    
    options = {}
    for (let i = 0; i < 18; i++) {
        // base date, compatible with chess.com date format (epoch)
        v = ((new Date(curYear + "-" + ((curMonth < 10 ? "0" : "") + curMonth) + "-01 00:00:00 GMT-0000")).getTime())/1000
        s = curMonth + "/" + curYear
        // ctrl.append($("<option />").val(v).text(s));
        curMonth -= 1
        if (curMonth == 0) {
            curMonth = 12
            curYear -= 1
        }
        options[v] = s
    }

    setSelectOptions(ctrl, options)
    loadValues()
})

function baseDate() {
    return new Date($('#baseMonth').val() + "/01")
}


