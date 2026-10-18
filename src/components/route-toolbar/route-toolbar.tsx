import {IconChevronLeft, IconChevronRight, IconHelp} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import {IconButton} from '../control/icon-button';
import {BackButton} from './back-button';
import './route-toolbar.css';

export interface RouteToolbarProps {
	helpUrl?: string;
	pinnedControls?: React.ReactNode;
	tabs: Record<string, React.ReactNode>;
}

export const RouteToolbar: React.FC<RouteToolbarProps> = props => {
	const {helpUrl = 'https://twinery.org/2guide', pinnedControls, tabs} = props;
	const {t} = useTranslation();
	const topRef = React.useRef<HTMLDivElement>(null);
	const [overflowing, setOverflowing] = React.useState(false);
	const [atEnd, setAtEnd] = React.useState(false);

	const updateScroll = React.useCallback(() => {
		const top = topRef.current;

		if (!top) return;
		setOverflowing(top.scrollWidth > top.clientWidth + 1);
		setAtEnd(top.scrollLeft >= top.scrollWidth - top.clientWidth - 1);
	}, []);

	React.useLayoutEffect(() => {
		updateScroll();
		window.addEventListener('resize', updateScroll);
		return () => window.removeEventListener('resize', updateScroll);
	}, [tabs, pinnedControls, updateScroll]);

	function scrollControls() {
		const top = topRef.current;

		if (!top) return;
		top.scrollLeft = atEnd ? 0 : top.scrollWidth - top.clientWidth;
		updateScroll();
	}

	return (
		<div className="route-toolbar">
			<Tabs selectedTabClassName="selected">
				<div className="route-toolbar-top-wrap">
					<div className="route-toolbar-top" ref={topRef} onScroll={updateScroll}>
						<BackButton />
						<TabList className="route-toolbar-tablist">
							{Object.keys(tabs).map(tabName => (
								<Tab className="route-toolbar-tab" key={tabName}>
									{tabName}
								</Tab>
							))}
						</TabList>
						<div className="route-toolbar-pinned-controls">
							{pinnedControls}
							<IconButton
								icon={<IconHelp />}
								label={t('common.help')}
								onClick={() => window.open(helpUrl, '_blank')}
							/>
						</div>
					</div>
					{overflowing && <div className="route-toolbar-scroll-cue">
						<IconButton
							icon={atEnd ? <IconChevronLeft /> : <IconChevronRight />}
							iconOnly
							label={t(atEnd ? 'common.earlierControls' : 'common.moreControls')}
							onClick={scrollControls}
						/>
					</div>}
				</div>
				<div>
					{Object.entries(tabs).map(([tabName, tabContent]) => (
						<TabPanel key={tabName}>{tabContent}</TabPanel>
					))}
				</div>
			</Tabs>
		</div>
	);
};
