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
        this._authorNames.add(authorName);
    }

    /**
     * Filter all comments containing the keyword.
     */
    filterKeyword(keyword) {
        keyword = keyword.trim();
        if (!keyword) {
            return;
        }

        this._keywords.add(keyword);
        this._keywordRegExp = this._buildRegExp();
    }

    /**
     * Build a regular expression that contains all keywords and all keywords must be separate from other words.
     * Thanks to regexp, I only have to pass comment text once + I don't have to worry about case sensitivity.
     * @returns Regular expression containin all keywords.
     */
    _buildRegExp() {
        const nonword = '[^a-z0-9]';
        const keywords = Array.from(this._keywords);

        // Make a complex regexp, so I don't have to check text for each keyword.
        // https://stackoverflow.com/a/6969486/2622707
        const regExpText = '(' + nonword +
            keywords.map(function (keyword, a1, a2) {
            return keyword.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        }).join('|') + nonword + ')';

        return new RegExp(regExpText, 'ig');
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

        if (this._keywords.size > 0)
        {
            const match = comment.text.match(this._keywordRegExp);
            if (match) {
                return new FilterResult(true, 'Comment is blocked because of keyword \'' + match.join('\', \'') + '\'.');
            }
        }

        return FilterResult.unfiltered;
    }
}

/**
 * A class responsible for managing all the stuff.
 */
class Comments {
    /**
     * Create a new viewmodel of all comments on a page.
     * @param {FilterSettings} settings - Settings of a filter.
     */
    constructor(settings) {
        this.settings = settings;
        this.comments = [];
    }

    add(comment) {
        this.comments.push(comment);
    }

    /**
     * Update all nodes for potential changes.
     */
    update() {
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

    get text() {
        let text = '';
        for (let commentBlock of this._commentBlocks) {
            text = text + commentBlock.textContent + '\n';
        }
        return text;
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
		const actionsNode = document.createElement('ul');
        actionsNode.classList.add('ievy-hidden');

        const dropdownArrow = document.createElement('button');
        dropdownArrow.appendChild(document.createTextNode('\u2699')); // unicode gear symbol
        dropdownArrow.addEventListener('click', function toggleActionVisibility(e) {
            const actionsClassList = actionsNode.classList;
            if (actionsClassList.contains('ievy-hidden')) {
                actionsClassList.remove('ievy-hidden');
            } else {
                actionsClassList.add('ievy-hidden');
            }
            e.preventDefault();
        });

        menuNode.appendChild(dropdownArrow);
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
        const showCommentNode = document.createElement('a');
        showCommentNode.appendChild(document.createTextNode('[Show]'));

        const hideCommentNode = document.createElement('a');
        hideCommentNode.classList.add('ievy-hidden');
        hideCommentNode.appendChild(document.createTextNode('[Hide]'));

        const that = this;
        showCommentNode.addEventListener('click', function showComment(e) {
            that.show();
            showCommentNode.classList.add('ievy-hidden');
            hideCommentNode.classList.remove('ievy-hidden');
            e.preventDefault();
        });
        hideCommentNode.addEventListener('click', function hideComment(e) {
            that.hide();
            showCommentNode.classList.remove('ievy-hidden');
            hideCommentNode.classList.add('ievy-hidden');
            e.preventDefault();
        });

        messageNode.appendChild(showCommentNode);
        messageNode.appendChild(hideCommentNode);

        this._metaDataNode.parentNode.insertBefore(messageNode, this._metaDataNode.nextSibling);
    }

    get _replyNode() {
        const commentBodyChildren = this._commentBodyNode.children;
        return commentBodyChildren[commentBodyChildren.length - 1];
    }

    get _vCardNode() {
		const vcardNode = this._commentBodyNode.querySelector('.vcard');
        return vcardNode;
    }

    get _metaDataNode() {
		const metaDataNode = this._commentBodyNode.querySelector('.comment-meta');
        return metaDataNode;
    }

    get _commentBodyNode() {
        return this.node.children[0];
    }
}

GM_addStyle(".ievy-hidden { display: none !important; }");

const settings = new FilterSettings();
settings.filterGravatar('ea0af1e6dffdfa291380200694704d13');
settings.filterKeyword('basement');
settings.filterKeyword('mommy');
settings.filterKeyword('FUDster');
    settings.filterKeyword('anyone');
        settings.filterKeyword('wager');
// HTMLCollection
const commentsNodes = document.getElementsByClassName('comment');
const comments = new Comments(settings);
for (let commentNode of commentsNodes) {
	const comment = new Comment(commentNode);
	comments.add(comment);
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
//    console.log('Text> ' + comment.text);
    comment.block(filterResult);
}
})();