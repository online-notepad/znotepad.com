require('dotenv').config();
const createDeployTasks = require('shipit-deploy');

const PM2_APP_NAME = 'ZNotepad'

module.exports = shipit => {
    createDeployTasks(shipit);
    require('shipit-npm')(shipit);

    shipit.initConfig({
        default: {
            deployTo: '/home/mediawant/public_html/znotepad.com',
            repositoryUrl: 'git@github.com:haipc/znotepad.com.git',
            branch: 'master',
            keepReleases: 3,
            ignores: ['.git', 'node_modules'],
            deleteOnRollback: false
        },
        production: {
            servers: 'mediawant@mediago',
        },
    });

    shipit.on('updated', () => {
        shipit.start('copyConfig');
    });

    shipit.task('copyConfig', async ()=> {
        await shipit.copyToRemote(
            '.env.production',
            '/home/mediawant/public_html/znotepad.com/current/.env'
        );

        require('dotenv').config();
    });

    shipit.blTask('startApp', async () => {
        await shipit.remote(
            ` pm2 startOrRestart /home/mediawant/public_html/znotepad.com/current/pm2-daemon.json`
        );

        shipit.log('Started ap process')
    });

    // When symlink changes, restart the app
    shipit.on('published', () => {
        shipit.start('startApp');
    });
};