// ==UserScript==
// @name         InsideEvs Zapper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Filter comments/users at site InsideEVs. Allows blocking of users and filtering of comments by text in the comment.
// @author       You
// @match        https://insideevs.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at document-end
// ==/UserScript==

(function() {
    'use strict';

class FilterResult {
    /**
     * Create a new filter result.
     */
    constructor(isBlocked, reason) {
        this.isBlocked = isBlocked;
        this.reason = reason;
    }

    toString() {
        return '[isBlocked:' + String(this.isBlocked) + ',reason:' + String(this.reason) + ']';
    }

    static get unfiltered() {
        return new FilterResult(false, undefined);
    }
}

class FilterSettings {
    constructor() {
        this._gravatars = new Set();
        this._authorNames = new Set();
        this._keywords = new Set();
    }

    /**
     * Filter all comments that are using the gravatar.
     * @param {String} gravatarHash - Has of a gravatar.
     */
    filterGravatar(gravatarHash) {
        this._gravatars.add(gravatarHash);
    }

    /**
     * Filter all comments from the author.
     * @param {String} authorName - Name of the author.
     */
    filterAuthor(authorName) {
        this._authorNames.add(gravatarHash);
    }

    /**
     * Test if the comment should be blocked.
     * @param {Comment} comment - tested comment.
     * @returns {FilterResult}
     */
    test(comment) {
        if (this._gravatars.has(comment.gravatar)) {
            return new FilterResult(true, 'Gravatar of the comment is blocked.');
        }

        if (this._authorNames.has(comment.authorName)) {
            return new FilterResult(true, 'Author of the comment is blocked.');
        }

        return FilterResult.unfiltered;
    }
}

/**
 * Wrapper around DOM node that represents the comment.
 */
class Comment {
	/**
	 * Create a new comment info.
	 * @param {Node} node - The HTML node in the DOM.
	 */
	constructor(node) {
		this.node = node;
	}

    /**
     * Get name of the author.
     */
	get authorName() {
		const authorNameNode = this._vCardNode.children[1];
		return authorNameNode.textContent;
	}

    /**
     * Get a gravatar hash.
     */
    get gravatar() {
        const gravatarUrl = this._vCardNode.children[0].getAttribute('src');
        return gravatarUrl.replace(/^.*avatar\//,'').replace(/\?.*/,'');
    }

    /**
	 * Adds a node handle to the comment, unless it already exists.
	 */
	addMenu() {
		if (this._actionsNode) {
			return;
		}

        const menuNode = document.createElement('div');
		this._commentBodyNode.insertBefore(menuNode, this._metaDataNode);

        const dropdownArrow = document.createElement('a');
        dropdownArrow.setAttribute('href','#');
        dropdownArrow.appendChild(document.createTextNode('\u2193'));
        dropdownArrow.addEventListener('click', function() {

        });
        menuNode.appendChild(dropdownArrow);

		const actionsNode = document.createElement('ul');
        menuNode.appendChild(actionsNode);

		this._actionsNode = actionsNode;
	}

    /**
	 * Add an action to the menu. Comment must have menu.
	 * @param {String} actionName - Name of the action to be displayed in the menu.
	 * @param {} callback - callback to call when the action is clicked on.
	 */
	addAction(actionName, callback) {
		const actionNode = document.createElement('li');
		const actionText = document.createTextNode(actionName);
		actionNode.appendChild(actionText);
        actionNode.addEventListener('click', callback.bind(this));
		this._actionsNode.appendChild(actionNode);
	}

    hide() {
        for (let commentBlock of this._commentBlocks) {
            commentBlock.classList.add('ievy-hidden');
        }
    }

    show() {
        for (let commentBlock of this._commentBlocks) {
            commentBlock.classList.remove('ievy-hidden');
        }
    }

    get _commentBlocks() {
        const commentBlocks = [];
        for (let commentBlock of this._commentBodyNode.children) {
            if (commentBlock.tagName.toLowerCase() == 'p') commentBlocks.push(commentBlock);
        }
        return commentBlocks;
    }

    /**
     * Block the comment.
     */
    block(result) {
        if (!result.isBlocked) {
            return;
        }

        this.hide();
        const messageNode = document.createElement('div');
        messageNode.style.fontStyle = 'italic';
        messageNode.appendChild(document.createTextNode(result.reason));
        this._commentBodyNode.insertBefore(messageNode, this._replyNode);
    }

    get _replyNode() {
        const commentBodyChildren = this._commentBodyNode.children;
        return commentBodyChildren[commentBodyChildren.length - 1];
    }

    get _vCardNode() {
		const vcardNode = this._commentBodyNode.children[0];
        return vcardNode;
    }

    get _metaDataNode() {
		const metaDataNode = this._commentBodyNode.children[1];
        return metaDataNode;
    }

    get _commentBodyNode() {
        return this.node.children[0];
    }
}

GM_addStyle(".ievy-hidden { display: none !important; }");

const settings = new FilterSettings();
settings.filterGravatar('ea0af1e6dffdfa291380200694704d13');
// HTMLCollection
const commentsNodes = document.getElementsByClassName('comment');
const comments = [];
for (let commentNode of commentsNodes) {
	const comment = new Comment(commentNode);
	comments.push(comment);
	console.log('Added a comment for author '+ comment.authorName);

    comment.addMenu();
    comment.addAction('Hide', function(event) {
        this.hide();
    });
    comment.addAction('Show', function(event) {
        this.show();
    });
    console.log('Gravatar> ' + comment.gravatar);

    const filterResult = settings.test(comment);
    console.log('Filter> ' + filterResult);
    comment.block(filterResult);
}
})();