"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const got_1 = __importDefault(require("got"));
const is_url_superb_1 = __importDefault(require("is-url-superb"));
const lodash_orderby_1 = __importDefault(require("lodash.orderby"));
const semver_1 = __importDefault(require("semver"));
class PeerDiscovery {
    constructor(seeds) {
        this.seeds = seeds;
        this.orderBy = ["latency", "desc"];
    }
    static async new({ networkOrHost, defaultPort = 4103, }) {
        if (!networkOrHost || typeof networkOrHost !== "string") {
            throw new Error("No network or host provided");
        }
        const seeds = [];
        try {
            if (is_url_superb_1.default(networkOrHost)) {
                const { body } = await got_1.default.get(networkOrHost);
                for (const seed of JSON.parse(body).data) {
                    let port = defaultPort;
                    if (seed.ports) {
                        const walletApiPort = seed.ports["@arkecosystem/core-wallet-api"];
                        const apiPort = seed.ports["@arkecosystem/core-api"];
                        if (walletApiPort >= 1 && walletApiPort <= 65535) {
                            port = walletApiPort;
                        }
                        else if (apiPort >= 1 && apiPort <= 65535) {
                            port = apiPort;
                        }
                    }
                    seeds.push({ ip: seed.ip, port });
                }
            }
            else {
                const { body } = await got_1.default.get(`https://raw.githubusercontent.com/lugondev/peers/master/${networkOrHost}.json`);
                for (const seed of JSON.parse(body)) {
                    seeds.push({ ip: seed.ip, port: defaultPort });
                }
            }
        }
        catch (error) {
            throw new Error("Failed to discovery any peers.");
        }
        if (!seeds.length) {
            throw new Error("No seeds found");
        }
        return new PeerDiscovery(seeds);
    }
    getSeeds() {
        return this.seeds;
    }
    withVersion(version) {
        this.version = version;
        return this;
    }
    withLatency(latency) {
        this.latency = latency;
        return this;
    }
    sortBy(key, direction = "desc") {
        this.orderBy = [key, direction];
        return this;
    }
    async findPeers(opts = {}) {
        if (!opts.retry) {
            opts.retry = { retries: 0 };
        }
        if (!opts.timeout) {
            opts.timeout = 3000;
        }
        const seed = this.seeds[Math.floor(Math.random() * this.seeds.length)];
        const { body } = await got_1.default.get(`http://${seed.ip}:${seed.port}/api/v2/peers`, {
            ...opts,
            ...{
                headers: {
                    "Content-Type": "application/json",
                },
            },
        });
        let peers = JSON.parse(body).data;
        if (this.version) {
            peers = peers.filter((peer) => semver_1.default.satisfies(peer.version, this.version));
        }
        if (this.latency) {
            peers = peers.filter((peer) => peer.latency <= this.latency);
        }
        return lodash_orderby_1.default(peers, [this.orderBy[0]], [this.orderBy[1]]);
    }
    async findPeersWithPlugin(name, opts = {}) {
        const peers = [];
        for (const peer of await this.findPeers(opts)) {
            const pluginName = Object.keys(peer.ports).find((key) => key.split("/")[1] === name);
            if (pluginName) {
                const port = peer.ports[pluginName];
                if (port >= 1 && port <= 65535) {
                    const peerData = {
                        ip: peer.ip,
                        port,
                    };
                    if (opts.additional && Array.isArray(opts.additional)) {
                        for (const additional of opts.additional) {
                            if (typeof peer[additional] === "undefined") {
                                continue;
                            }
                            peerData[additional] = peer[additional];
                        }
                    }
                    peers.push(peerData);
                }
            }
        }
        return peers;
    }
}
exports.PeerDiscovery = PeerDiscovery;
//# sourceMappingURL=discovery.js.map
