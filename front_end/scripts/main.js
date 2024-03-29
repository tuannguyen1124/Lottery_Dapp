import { getContract, convertState, sliceLongValue } from "./helper_functions.js"

const web3 = new Web3(ethereum)
const chainId = "4" // rinkeby 

let userAccount
let entryFee
let contract 
let token

const balanceOfABI = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "balance",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
];

let contractToken

// Accessing elements throught DOM
const prizePoolSpan = document.querySelector(".prize-pool span")
const countdownSpan = document.querySelector(".countdown span")
const lotteryStateSpan = document.querySelector(".state span")
const totalEntriesSpan = document.querySelector(".entry-counter span")
const userEntriesSpan = document.querySelector(".user-entry-counter span")
const userBalanceSpan = document.querySelector(".user-balance span")
const latestWinnerSpan = document.querySelector(".latest-winner span")
const randomNumberSpan = document.querySelector(".random-number span")
const entryFeeSpan = document.querySelector(".entry-price")

const connectBtn = document.querySelector(".connect-button")
const startBtn = document.querySelector(".start-lottery")
const entriesInput = document.querySelector("input#number-of-entries")
const enterBtn = document.querySelector(".enter-lottery")
const showBtn = document.querySelector(".show-results")

connectBtn.addEventListener("click", connectMetamask);
startBtn.addEventListener("click", startLottery)
entriesInput.addEventListener("input", updatePrice)
showBtn.addEventListener("click", endLottery)
enterBtn.addEventListener("click", (e) => {
    e.preventDefault()
    enterLottery(parseInt(entriesInput.value))     
})

async function main() {
    if (typeof ethereum == "undefined") {
        throw new Error("You don't have the metamask extension installed")
    }

    if (web3.currentProvider.chainId !== "0x4") {
        try {
            await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x4"}]
            })
        } catch (error) {
            alert(error.message)
        }
    }
    contract = await getContract("Lottery", chainId)
    token = await getContract("BAPToken", chainId)
    contractToken = new web3.eth.Contract(balanceOfABI, token._address)

    loadDappData()
    
}
main()
.catch(error => {
    alert(error.message)
})

// metamask event
ethereum.on("chainChanged", () => {
    window.location.reload()
})

async function connectMetamask() {
    try {
        const accounts = await ethereum.request({ method: "eth_requestAccounts" })
        userAccount = accounts[0]
        loadUserData()
        // change button styles
        connectBtn.classList.add("connected")
        connectBtn.textContent = sliceLongValue(userAccount)
    } catch (error) {
        if (err.code === 4001) {
            console.log("Please connect to MetaMask.")
        } else {
            console.error(err)
        }
    }
}

function startLottery() {
    contract.methods.startLottery().send({
        from: userAccount
    }).on("transactionHash", (hash) => {
        console.log(hash)
    }).on("receipt", () => {
        loadDappData()
    }).on("error", (error) => {
        console.log(error)
    })
}

function enterLottery(entryNumber) {
  //  let cost = (entryNumber * entryFee *10**18).toString()
  //  token.methods.transfer(contract.options.address, cost).send({from: userAccount});
    contract.methods.enterLottery(entryNumber).send({
            from: userAccount,
            
    })
    .on("transactionHash", (hash) => {
        console.log(hash)
    }).on("receipt", () => {
        resetDapp()
    }).on("error", (error) => {
        console.log(error)
    })
}

function endLottery() {
    contract.methods.endLottery().send({
        from: userAccount
    }).on("transactionHash", (hash) => {
        console.log(hash)
    }).on("receipt", () => {
        resetDapp()
    }).on("error", (error) => {
        console.log(error)
    })
    // Listen for the end of the lottery
    contract.events.LotteryFinished()
    .on("data", ()=>{
        resetDapp()
    })
}

async function loadUserData() {
    userEntriesSpan.textContent = await contract.methods.participantEntries(userAccount).call()
    const result = await contractToken.methods.balanceOf(userAccount).call()
    userBalanceSpan.textContent = parseFloat(
         result/(10**18)
    )
    .toFixed(0)
}

function updatePrice(e) {
    let result = parseFloat(e.target.value * entryFee)
    entryFeeSpan.textContent = `Price ${result}`
}

async function updateState() {
    let state = convertState(await contract.methods.lotteryState().call())
    let deadline = await contract.methods.lotteryDeadlineTimestamp().call()
    // convert miliseconds to seconds
    let timeStamp = Date.now() / 1000
    lotteryStateSpan.classList = state.toLowerCase()
    lotteryStateSpan.textContent = state
    if (state === "Closed") {
        startBtn.disabled = false
        showBtn.disabled = true
    } else if (state === "Opened" && timeStamp >= deadline) {
        startBtn.disabled = true
        showBtn.disabled = false
    } else {
        startBtn.disabled = true
        showBtn.disabled = true
    }
}

// Populates spans with data retrieved from the smart contract
async function loadDappData() {
    updateState()
    const result = await contractToken.methods.balanceOf(contract.options.address).call()
    prizePoolSpan.textContent = parseFloat(
        result/(10**18)
    )
    .toFixed(0)
  
    entryFee = 50;
    entryFeeSpan.textContent = `Price: ${entryFee}`
    totalEntriesSpan.textContent = await contract.methods.entryCounter().call()
    randomNumberSpan.textContent = sliceLongValue(
        await contract.methods.randomness().call()
    )
    latestWinnerSpan.textContent = sliceLongValue(
        await contract.methods.latestWinner().call()
    )

    // randomNumberSpan.textContent = 
    //  await contract.methods.randomness().call()
    
    // latestWinnerSpan.textContent =
    //     await contract.methods.latestWinner().call()
    
    startCountdown()
}

async function startCountdown() {
    let deadline = await contract.methods.lotteryDeadlineTimestamp().call()
    setInterval(updateCountdown, 100, deadline)
}

function updateCountdown(deadline) {
    let timestamp = deadline - (Date.now() / 1000) 
    if (timestamp <= 0) {
        countdownSpan.textContent = "00:00:00"
        return
    }
    let hours = Math.floor(timestamp / 3600) 
    let minutes = Math.floor((timestamp % 3600) / 60)
    let seconds = Math.floor(timestamp % 60)
    
    let tmp = [hours, minutes, seconds]
    tmp.forEach((item, index) => {
        tmp[index] = item.toLocaleString("en-US", {
            minimumIntegerDigits: 2,
            useGrouping: false  
        })  
    })
    countdownSpan.textContent = `${tmp[0]}:${tmp[1]}:${tmp[2]}`
}

function resetDapp() {
    loadDappData()
    loadUserData()
}