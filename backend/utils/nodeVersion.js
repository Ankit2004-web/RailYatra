function getNodeMajorVersion() {
    return Number(process.version.slice(1).split('.')[0]);
}

function isSupportedNodeVersion() {
    const major = getNodeMajorVersion();
    return major >= 20 && major <= 22;
}

function assertSupportedNodeVersion() {
    if (!isSupportedNodeVersion()) {
        console.error(`\nNode.js ${process.version} is not supported for RailYatra.`);
        console.error('Use Node.js 20.x or 22.x LTS (see .nvmrc).\n');
        process.exit(1);
    }
}

module.exports = {
    getNodeMajorVersion,
    isSupportedNodeVersion,
    assertSupportedNodeVersion
};
