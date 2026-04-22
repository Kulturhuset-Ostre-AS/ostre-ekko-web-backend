<?php
/**
 * Ekko module for Craft CMS 3.x
 *
 * Custom functionality for Ekko site
 *
 * @link      http://pauliusfriedt.com
 * @copyright Copyright (c) 2020 Paulius Friedt
 */

namespace modules\ekkomodule\variables;

use modules\ekkomodule\EkkoModule;

use Craft;

/**
 * Ekko Variable
 *
 * Craft allows modules to provide their own template variables, accessible from
 * the {{ craft }} global variable (e.g. {{ craft.ekkoModule }}).
 *
 * https://craftcms.com/docs/plugins/variables
 *
 * @author    Paulius Friedt
 * @package   EkkoModule
 * @since     1.0.0
 */
class EkkoModuleVariable
{
    /*
	 * Prepare performances array to be accessed by artist ID
	 */
	public function prepPerformances($performances) {
		$return = array();

		foreach ($performances as $singlePerf) {
			if (array_key_exists($singlePerf->artist[0]->id, $return))
				array_push($return[$singlePerf->artist[0]->id], $singlePerf);
			else $return[$singlePerf->artist[0]->id] = array($singlePerf);

			// $return[$singlePerf->artist[0]->id] = $singlePerf;
		}

		return $return;
	}

	/*
	 * Selects the closest upcoming or the last past performance
	 */
	public function currentPerformance($performances) {
		$lastPerformance = $performances->inReverse()->one();

		if ($performances->count() == 1) {
			return $performances->one();
		}
		else {
			$performances->date('>= ' . date('Y-m-d H:i:s'));
			if ($performances->count() >= 1) return $performances->one();
			else return $lastPerformance;
		}
	}

	/*
	 * Group performances for program output
	 */
	public function prepProgram($performances) {
		$return = array();
		// $allPerformances = $performances->all();
		$allPerformances = $performances;

		foreach ($allPerformances as $singlePerf) {
			$date = $singlePerf->date->format('Y-m-d');
			$location = $this->prepLocation($singlePerf->location);

			if (!array_key_exists($date, $return)) $return[$date] = array();
			if (!array_key_exists($location->fullTitle, $return[$date])) {
				$return[$date][$location->fullTitle] = array($singlePerf);
			}
			else {
				array_push($return[$date][$location->fullTitle], $singlePerf);
			}
		}

		// Craft::dd($return);
		return $return;
	}

	/*
	 * Exctract artist entries from array of performances
	 */
	public function prepArtists($performances) {
		$return = array();

		foreach ($performances as $singlePerf) {
			$artist = $singlePerf->artist[0];

			if ($artist->isVisible && !array_key_exists($artist->id, $return))
				$return[$artist->id] = $artist;
		}

		return $return;
	}

	/*
	 * Select correct location for the event / artists
	 */
	public function prepLocation($locations) {
		if (is_object($locations)) $locations = $locations->all();

		$location = array_shift($locations);

		foreach ($locations as $loc) {
			if ($loc->level == '2') $location = $loc;
		}

		return $location;
	}

	/*
	 * Get artist entries related to an event through performance entries
	 *
	 * return ElementModelCriteria
	 */
	public function artists($event) {
        return EkkoModule::$instance->ekko->getEventArtists($event);
		// return craft()->ekko->getEventArtists($event);
	}

	/*
	 * Get artist entries related to an event through performance entries
	 *
	 * return ElementModelCriteria
	 */
	public function performances($event) {
        return EkkoModule::$instance->ekko->getEventPerformances($event, 'performances');
		// return craft()->ekko->getEventPerformances($event, 'performances');
	}

	/*
	 * Get artist entries related to an event through performance entries
	 *
	 * return ElementModelCriteria
	 */
	public function eventPerformances($event) {
        return EkkoModule::$instance->ekko->getEventPerformances($event, 'performances');
		// return craft()->ekko->getEventPerformances($event, 'performances');
	}
}
