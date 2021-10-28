const SEND = 'send'
const REFUND = 'refund'
const RETURN = 'return'
const ASYM = 'asym'
const SENTINEL = 'sentinel'
const SENTINEL_REFUND = 'sentinel_refund'

// internal
function buildID (txid, type) {
	let externalIndex = [{ txid, type }]
	return JSON.stringify(externalIndex)
}

// external
function getSendID (txid) {
	return buildID(txid, SEND)
}

function getRefundID (txid) {
	return buildID(txid, REFUND)
}

function getReturnID (txid) {
	return buildID(txid, RETURN)
}

function getAsymID (txid) {
	return buildID(txid, ASYM)
}

function getSentinelID (txid) {
	return buildID(txid, SENTINEL)
}

function getSentinelRefundID (txid) {
	return buildID(txid, SENTINEL_REFUND)
}

function getBatchID (sendData) {
	// The external index for a batch send will be every tx
	// in the batch separated by a colon, ex: txid:txid:txid
	let txs = []
	sendData.map((tx) => {
		let txid = tx[0]
		let status = tx[4]
		let type
		if (status === 'pending_batch_send') {
			type = SEND
		} else if (status === 'pending_batch_return') {
			type = RETURN
		}
		txs.push({ txid, type })
	})
	return JSON.stringify(txs)
}

module.exports = {
	SEND,
	REFUND,
	RETURN,
	ASYM,
	SENTINEL,
	SENTINEL_REFUND,
	getSendID,
	getRefundID,
	getReturnID,
	getAsymID,
	getSentinelID,
	getSentinelRefundID,
	getBatchID
}